'use strict';

// Installs run one at a time, in the order they were asked for.
//
// Two downloads side by side would only halve each other's speed and double the free space asked
// for, and two installs of one product would race for the same version folder. The launcher used
// to guard this with a single busy flag that dropped any second request without a word; a queue
// keeps the request and says where it is.
//
// A job is `install` (download, verify, activate) or `download` (download and verify only, for an
// update to a product that is running). Asking again for something already queued or running
// gets the same job back. An install asked for while that product's download is queued takes the
// download's place; one asked for while its download runs waits behind it.
//
// A change of jobs (queued, started, finished) is reported to `onChange` at once. Progress is
// reported to `onProgress`, or to `onChange` when there is none, at most once every
// `progressIntervalMs`: the first report straight away, the latest one at the end of the interval,
// and any pending one before the next change of jobs. Every report used to rebuild the launcher's
// whole state on the spot, thousands of times a second during a download.

const PROGRESS_INTERVAL_MS = 250;

function createInstallQueue({ run, onChange = () => {}, onProgress = null, progressIntervalMs = PROGRESS_INTERVAL_MS }) {
  const jobs = [];
  let active = null;
  let progressAt = 0;
  let progressTimer = null;

  function snapshot() {
    return jobs.map(({ id, kind, state, progress, explicit }) => ({
      id, kind, state, explicit, progress: progress ? { ...progress } : null,
    }));
  }

  function notify() {
    // A change of jobs carries the latest progress with it.
    if (progressTimer) {
      clearTimeout(progressTimer);
      progressTimer = null;
    }
    try {
      onChange(snapshot());
    } catch {
      // A listener's failure is not the queue's.
    }
  }

  function sendProgress() {
    progressTimer = null;
    progressAt = Date.now();
    try {
      (onProgress || onChange)(snapshot());
    } catch {
      // As above.
    }
  }

  function progressed() {
    if (progressTimer) return;
    const wait = progressAt + progressIntervalMs - Date.now();
    if (wait <= 0) sendProgress();
    else progressTimer = setTimeout(sendProgress, wait);
  }

  async function pump() {
    if (active) return;
    const next = jobs.find((job) => job.state === 'queued');
    if (!next) return;
    active = next;
    next.state = 'running';
    notify();
    try {
      next.resolve(await run(next, (progress) => {
        next.progress = progress;
        progressed();
      }));
    } catch (error) {
      next.reject(error);
    } finally {
      jobs.splice(jobs.indexOf(next), 1);
      active = null;
      notify();
      pump();
    }
  }

  function enqueue(id, { kind = 'install', explicit = false } = {}) {
    if (!['install', 'download'].includes(kind)) throw new Error(`Unknown install job: ${kind}`);
    const queued = jobs.find((job) => job.id === id && job.state === 'queued');
    if (queued) {
      if (kind === 'install') queued.kind = 'install';
      queued.explicit = queued.explicit || explicit;
      notify();
      return queued.promise;
    }
    const running = jobs.find((job) => job.id === id && job.state === 'running');
    if (running && (kind === 'download' || running.kind === 'install')) {
      running.explicit = running.explicit || explicit;
      return running.promise;
    }
    const job = { id, kind, explicit, state: 'queued', progress: null };
    job.promise = new Promise((resolve, reject) => {
      job.resolve = resolve;
      job.reject = reject;
    });
    // Whoever enqueued an automatic job may never look at its result; its failure is reported
    // through `run`, not as an unhandled rejection.
    job.promise.catch(() => {});
    jobs.push(job);
    notify();
    pump();
    return job.promise;
  }

  return {
    enqueue,
    jobs: snapshot,
    has: (id) => jobs.some((job) => job.id === id),
    jobFor: (id) => snapshot().find((job) => job.id === id) || null,
  };
}

module.exports = { createInstallQueue };
