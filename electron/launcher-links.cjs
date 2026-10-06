'use strict';

// The only addresses the launcher window can ask to open in the browser. The renderer names a
// key, never a URL, so a compromised page cannot send anyone anywhere else.

const SITE = 'https://boneheadlabs.org/';
const ORGANISATION = 'https://github.com/Bonehead-Labs';
const repositoryPart = /^[A-Za-z0-9_.-]+$/;

function repositoryUrl(repository) {
  if (!repository || repository.provider !== 'github') return '';
  const { owner, name } = repository;
  if (!repositoryPart.test(String(owner || '')) || !repositoryPart.test(String(name || ''))) return '';
  return `https://github.com/${owner}/${name}`;
}

// `catalog` is the shipped products/catalog.json: its `launcher.repository` and each product's
// `repository` say where the code and its issues live.
function linkFor(key, catalog) {
  const text = String(key || '');
  if (text === 'site') return SITE;
  if (text === 'github') return ORGANISATION;
  const launcher = repositoryUrl(catalog?.launcher?.repository);
  if (text === 'source') {
    if (!launcher) throw new Error('The launcher has no source repository configured.');
    return launcher;
  }
  const issues = text.match(/^issues:([a-z][a-z0-9-]*)$/);
  if (issues) {
    const id = issues[1];
    const base = id === 'instrumenta' ? launcher
      : repositoryUrl((catalog?.products || []).find((product) => product.id === id)?.repository);
    if (!base) throw new Error(`There is nowhere to report a problem with ${id} yet.`);
    return `${base}/issues/new`;
  }
  throw new Error('Unknown link.');
}

module.exports = { linkFor, ORGANISATION, SITE };
