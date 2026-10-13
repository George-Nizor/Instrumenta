# Reference image sources and art sites for the drawing app

Research date: 13 October 2026. Companion JSON: `05-reference-sources-and-art-sites.json` (arrays `image_sources` and `sites`).

## How this was researched, and what could not be checked

The environment's network policy refused direct page opens for almost every outside host, including metmuseum.github.io, api.artic.edu, openaccess-api.clevelandart.org, unsplash.com, pexels.com and en.wikipedia.org. Only github.com and raw.githubusercontent.com could be opened. WebSearch worked until the shared search budget ran out partway through Part A, so Part B had no searches at all.

Every claim below carries one of four evidence tags:

- [opened]: I opened the page or file in this pass. All of these are GitHub-hosted: museum open-data READMEs, the Art Institute of Chicago API docs source, the Openverse API code and terms, the Openverse ingestion scripts (they show how a large open-source project calls each API and reads its licence fields), the unsplash-js README, and the Wikimedia CommonsMetadata parser.
- [search]: seen only in search-result text that quotes or summarises the named page. I did not open the page.
- [prior]: taken from the earlier research pass in the handoff folder, which opened those pages and ran a link check on 2026-10-13. I did not re-check them.
- [unconfirmed]: my background knowledge, not checked in this pass. Use it as a lead only.

In Part B, "active in 2026" is stated only where a dated 2026 post was seen in the earlier pass. Otherwise the row says what is known, such as "reachable on 2026-10-13".

## Part A: image sources the viewer may display

### Takeaway

- Four sources need no key and cover a lot: the Met, the Art Institute of Chicago (AIC), the Cleveland Museum of Art and Wikimedia Commons. The three museums are CC0 for their open-access works, so the app can cache their images. Commons is licensed per file, so the app has to read each file's licence before showing it. All four can ship in the public MIT repo with no secrets.
- Eight sources need a free key that the user enters in settings. The key stays in the Electron launcher and is never committed. They are the Smithsonian (api.data.gov key), Unsplash, Pexels, Pixabay, Europeana, Flickr, the Biodiversity Heritage Library (BHL) and Openverse (OAuth client). Each has its own display rule. Unsplash images must be hotlinked and attributed, and the download endpoint must be called. Pixabay forbids permanent hotlinking and requires API responses to be cached for 24 hours. Openverse forbids scraping and requires a notice that the app was "made using Openverse but is not endorsed or certified by Openverse".
- Six more sources are usable with care because of rate limits, per-item rights or a bulk-data route: iNaturalist (keyless, about 1 request a second), the Library of Congress (keyless, 20 JSON requests a minute), NASA, the Rijksmuseum (its new search API is keyless), Getty, and the National Gallery of Art (no public API, CC0 CSV on GitHub).
- None of the pose sites (Line of Action, Quickposes, SketchDaily, Croquis Cafe, Posemaniacs, Character Design References, Proko Timer) offers a public API or embeddable sessions. Where terms were seen, they limit images to use inside the site's own tools. The app should link out to them. AdorkaStock (formerly SenshiStock) is the one exception on licence: it is CC BY 3.0 and allows sharing with credit and a live link, so a small hand-picked local pack is legal. It still has no API.

### Summary table

| Source | API and key | Image licence | In-app display | Cache image files | Key in public repo |
|---|---|---|---|---|---|
| The Met | REST JSON, no key, about 80 req/s asked | CC0 where `isPublicDomain` is true | yes (public domain only) | yes | no key needed |
| Art Institute of Chicago | REST JSON plus IIIF, no key, 60 req/min per IP | CC0 public-domain images; use `is_public_domain` | yes (public domain only) | yes | no key needed |
| Cleveland Museum of Art | REST JSON, no key | CC0 where `share_license_status` is CC0 | yes (CC0 only) | yes | no key needed |
| Rijksmuseum | new Linked Art search, no key; legacy API needed a key | public domain or CC0; CC BY 4.0 where copyright applies | yes for public domain and CC0; conditional for CC BY | yes for public domain and CC0 | no key needed (new API) |
| Smithsonian Open Access | REST JSON, api.data.gov key, 1,000 req/hour | CC0 where media `usage.access` is CC0 | yes (CC0 only) | yes | user supplies key |
| National Gallery of Art | no documented API; CC0 CSV dataset | images free for any use (museum statement) | yes, from a local index | yes | no key needed |
| Getty | Linked Art, IIIF and SPARQL; key status unconfirmed | CC0 for Open Content images, not all images | conditional (CC0 only) | yes for CC0 | probably none (unconfirmed) |
| Europeana | REST JSON, `wskey` required | per item; `reusability=open` gives PDM, CC0, CC BY, CC BY-SA | conditional | licence-dependent | user supplies key |
| Wikimedia Commons | MediaWiki API, no key, unique User-Agent | per file (PD, CC0, CC BY, CC BY-SA and others) | conditional (allow-list) | yes, with attribution | no key needed |
| Openverse | REST JSON; anonymous tier is tiny; OAuth for 10,000/day | per item (CC and PD), not verified by Openverse | conditional | only what the user viewed; no scraping | user registers own client |
| Library of Congress | loc.gov `fo=json`, no key, 20 req/min | per item rights advisory | conditional | yes for "no known restrictions" items | no key needed |
| Biodiversity Heritage Library | API v3, key on every request | public domain items free; others CC BY-NC | conditional | yes, with credit | user supplies key |
| Flickr | REST, key required (non-commercial or commercial) | per photo; IDs 4, 5, 9, 10 are CC BY, CC BY-SA, CC0, PDM | conditional | short-lived (terms unconfirmed) | user supplies key |
| iNaturalist | REST JSON, no key for reads (unconfirmed), about 1 req/s | per photo: CC0, CC BY variants, or all rights reserved | conditional (CC only) | yes, with attribution; no bulk | no key needed |
| Unsplash | REST, Access Key, 50 req/hour demo, 5,000 production | Unsplash License, but API rules apply | conditional (hotlink only) | no | user supplies key |
| Pexels | REST, key, 200 req/hour, 20,000 a month | Pexels License | conditional | likely yes (terms unconfirmed) | user supplies key |
| Pixabay | REST, key, 100 req per 60 s | Pixabay Content License | conditional (download, do not hotlink) | yes, and must cache API responses 24 h | user supplies key |
| NASA Image and Video Library | REST, key status unconfirmed | NASA media generally not under US copyright | yes, excluding third-party items | yes | probably none (unconfirmed) |
| Line of Action, Quickposes, SketchDaily, Croquis Cafe, Posemaniacs, Character Design References, Proko Timer | no public API or embed found | site-only or not stated | no: link out | no | not applicable |
| AdorkaStock (SenshiStock) | no API | CC BY 3.0 with credit and live link | conditional (hand-picked local pack) | yes, with credit | not applicable |

### Source details

The Met Collection API
- Endpoint `https://collectionapi.metmuseum.org/public/collection/v1/` with `/objects`, `/objects/{id}` and `/search?isPublicDomain=true&q=...` [opened: Openverse Met script].
- No key. The docs say "At this time, we do not require API users to register or obtain an API key to use the service. Please limit request rate to 80 requests per second." [search: metmuseum.github.io]. One developer reported firewall blocks well below that and throttles to about 20 a second [search], so keep the app far lower.
- Licence: the Openverse ingester keeps only objects with `isPublicDomain` true and labels them CC0 1.0. It reads `primaryImage`, `additionalImages`, `objectURL`, `artistDisplayName` and `creditLine` [opened]. The open-access policy covers over 492,000 public-domain images [prior].
- Attribution is requested but not required. The Met asks users not to imply endorsement or use its trademarks [opened: metmuseum/openaccess README].
- Coverage: paintings, drawings, prints, sculpture, arms and armour, costume, decorative objects and photographs. Strong for master copies and still-life objects. Some animals and architecture appear through prints.

Art Institute of Chicago API (IIIF)
- "You may access our API without authentication." Anonymous users get 60 requests a minute per IP. The docs also ask for "no more than one per second", to "Cache API responses in your system when possible" and to avoid extensive scraping. As a courtesy they ask for an `AIC-User-Agent` header with the project name and a contact email [opened: data-aggregator docs/.sections/preface.md, the source of api.artic.edu/docs].
- Image URL pattern: `https://www.artic.edu/iiif/2/{image_id}/full/843,/0/default.jpg`. The docs recommend 843 px wide because "this is the most common size used by our website" [opened]. A third-party developer reports that public-domain images are now capped at 843 px and that requests without the AIC header can get a bot-check 403 [search; unconfirmed].
- Licence: the docs recommend "only using images from artworks that are tagged as public domain" and say "It is up to you to determine whether or not you are allowed to use these images" [opened]. The open-access page describes over 50,000 public-domain images as CC0 and asks for a credit line [prior].
- Coverage: paintings, prints and drawings, a strong architecture and design department, photography, textiles and Japanese prints. Good for master copies, architecture drawings and landscape prints.

Cleveland Museum of Art Open Access API
- Endpoint `https://openaccess-api.clevelandart.org/api/artworks/`. The Openverse script queries `cc=1&has_image=1`, keeps only records whose `share_license_status` is CC0, and takes the image from `images.web.url`, then `images.print.url`, then `images.full.url`. The creator comes from `creators[0].description` [opened: Openverse Cleveland script].
- No key [search: third-party listing]. The README does not mention rate limits [opened]. Openverse waits 5 between calls [opened].
- Licence: CC0. "Attribution is not required, but does support efforts to release other datasets in the future." Modified data must be marked as modified, and users must not imply endorsement [opened: ClevelandMuseumArt/openaccess README].
- Coverage: about 60,000 to 70,000 records, with CC0 images for more than half the collection [prior; search]. Strong for armour, ceramics, metalwork and other objects, plus Asian art, prints and drawings.

Rijksmuseum
- The new Search API at `data.rijksmuseum.nl/search/collection` needs no key and returns Linked Art identifiers to resolve with the museum's other APIs [search: data.rijksmuseum.nl/docs/search]. The older `rijksmuseum.nl/api` needed a key from a Rijksstudio account [search]. A developer describes the image chain as Object, then VisualItem, then DigitalObject, ending at a `iiif.micr.io` IIIF service [search; unconfirmed].
- Licence: public domain or CC0 where the museum holds no rights, CC BY 4.0 where copyright applies, and some works restricted. Credit is requested [prior: data.rijksmuseum.nl/policy].
- Coverage: Dutch and European paintings and a very large print and drawing collection (animals, landscapes, architecture, figure studies). Excellent for master copies of drawings and prints. More work to integrate than the other museums because of the Linked Art resolution steps.

Smithsonian Open Access API
- Endpoint `https://api.si.edu/openaccess/api/v1.0/search` with an `api_key` parameter from api.data.gov. Openverse queries `online_media_type:Images AND media_usage:CC0` and keeps media items whose `usage.access` is CC0. Images are under `content.descriptiveNonRepeating.online_media.media[]` [opened: Openverse Smithsonian script].
- Limits: 1,000 requests an hour per registered key. DEMO_KEY allows only 30 an hour and 50 a day per IP. Going over returns 429 with a Retry-After header [search: api.data.gov docs and a community client].
- Licence: CC0 for items marked open access; the programme has about 5.2 million items [prior]. The GitHub README has moved bulk data to the AWS Registry of Open Data, covering 11 million metadata records [opened].
- Key policy: the key is personal. Ship no key and let the user paste their own free key in settings [unconfirmed that terms forbid sharing; this is the safe choice].
- Coverage: the widest of any museum source. It includes natural-history specimens (animals and plants), air and space hardware, design objects, tools, American art and portraits. Strong for objects, animal structure and art.

National Gallery of Art (Washington)
- The open data programme publishes CSV files on GitHub under CC0. "Images and media files are not included in the dataset", though the dataset holds links to images. The data is updated "usually once a day" [opened: NationalGalleryOfArt/opendata README]. There is a `published_images.csv`, but it was too large for my fetch, so its columns are unconfirmed [opened, failed]. No documented public REST API [search].
- Licence: the museum says images of its open-access works are free "for any use, commercial or non-commercial" [search: nga.gov free images page; prior].
- How to use it: build a small local index from the CSV, for example drawings, prints and Muybridge plates, and fetch images by their published links. Coverage: Western paintings, prints and drawings, photographs and Muybridge motion plates [prior].

Getty Museum collection
- Linked Art REST endpoints plus the IIIF Image and Presentation APIs and a SPARQL endpoint [search: data.getty.edu/museum/collection/docs]. "With some exceptions" the data is CC0. "Many of the linked images" are Open Content CC0, "but not all" [search]. A third party says no key is needed [search; unconfirmed officially].
- About 88,000 CC0 images as of 2024 [search: Getty release].
- Coverage: European paintings, drawings, manuscripts, photographs and antiquities. Show only images whose rights statement is CC0.

Europeana API
- Search endpoint `https://api.europeana.eu/record/v2/search.json` with a `wskey` parameter. Openverse also sends `media=true`, `qf=TYPE:IMAGE`, and reads the licence URI from `rights`, the image from `edmIsShownBy` and the thumbnail from `edmPreview` [opened: Openverse Europeana script].
- `reusability=open` limits results to Public Domain Mark, CC0, CC BY and CC BY-SA [search: Europeana API FAQ]. The FAQ says there is no throttling, but the Search API docs list a 429 response, so expect a limit [search].
- Images are served by the contributing institutions, so hotlinks can be slow or break. Coverage: very broad European heritage (art, photographs, natural history, architecture) with uneven quality.

Wikimedia Commons API, and reading a file's licence
- Query `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600&titles=File:...&format=json`. Openverse uses `iiprop=url|user|dimensions|extmetadata|mediatype|mime|size|metadata` [opened: Openverse Wikimedia script]. `iiurlwidth` returns a scaled thumbnail URL [unconfirmed; the search did not reach the API:Imageinfo page].
- The extmetadata fields come from the CommonsMetadata extension. Licence fields: `LicenseShortName`, `UsageTerms`, `AttributionRequired`, `Attribution`, `LicenseUrl` (dropped unless http or https), `NonFree` and `Copyrighted`. Description fields: `ImageDescription`, `DateTimeOriginal`, `Artist`, `Credit`, `ObjectName` and `Permission`. There is also a `Restrictions` field, for example personality rights [opened: CommonsMetadata TemplateParser.php]. Values are HTML, and Commons warns they are unreliable for multi-licensed files [search: Commons:Machine-readable data, API:Imageinfo].
- Rule for the app: show a file only if `NonFree` is absent, `LicenseShortName` matches an allow-list (Public domain, CC0, CC BY any version, CC BY-SA any version), and `Restrictions` is empty or only says personality rights for a non-commercial viewer. Strip the HTML from `Artist` for the credit and keep `LicenseUrl` and the file page link.
- Hotlinking is "allowed" but "not generally recommended", and licence conditions still apply. `Special:FilePath` with a width gives a stable URL [search: Commons:Reusing content outside Wikimedia/technical]. Wikimedia requires a unique User-Agent [opened: Openverse script notes]. The policy page itself was not opened. Browsers cannot set User-Agent, so the launcher should make these requests [unconfirmed: browsers may send an `Api-User-Agent` header instead].
- Coverage: the largest single pool. It has animals, plants, landscapes, architecture, people in action (watch personality rights and nudity) and public-domain art reproductions, including the Muybridge Animal Locomotion category [prior].

Openverse API
- Code defaults for anonymous use are 5 requests an hour burst and 100 a day sustained, with thumbnails at 150 a minute. Registered OAuth client-credentials apps get 100 a minute and 10,000 a day [opened: api/conf/settings/rest_framework.py; production values are set by environment and may differ].
- Terms (effective 5 May 2022): give proper attribution to CC-licensed works; "You must adhere to all rate limits, registration requirements"; "You must not scrape the content in the Openverse catalog"; an app built on the API "must prominently indicate that it was made using Openverse but is not endorsed or certified by Openverse". Openverse "does not verify its licensing status" [opened: documentation/terms_of_service.md].
- Responses include `license`, `license_version`, `license_url`, `creator`, `creator_url`, `foreign_landing_url`, `attribution` and `thumbnail` [opened: media_serializers.py field list]. Use the `attribution` string as the credit.
- Key policy: the client secret cannot ship in a public repo. Either the user registers their own client or the app uses the anonymous tier, which is too small for sessions.
- Coverage: an aggregator of Flickr, Wikimedia, museums, iNaturalist (through the AWS dump), Rawpixel, StockSnap and others [opened: provider script list]. Good for random prompts.

Library of Congress loc.gov API
- Add `?fo=json` to any loc.gov search or item URL. No key. Limits: 20 JSON requests a minute and 150 image requests a minute; going over blocks you for an hour, and 429 or CAPTCHA responses can come earlier under load [search: loc.gov/apis/json-and-yaml/working-within-limits]. Paging stops at item 100,000 [search].
- Rights are per item. Use items whose rights advisory says no known restrictions, and the curated "Free to Use and Reuse" sets of 25 to 50 images each [prior]. How rights appear in the JSON was not confirmed [search found nothing].
- Coverage: historic photographs and prints, and very strong for architecture through the Historic American Buildings Survey photographs and measured drawings [unconfirmed that the HABS collection is generally rights-free; it is US government work].

Biodiversity Heritage Library API and Flickr
- API v3 needs a key on every request [search: biodiversitylibrary.org/docs/api3.html]. Metadata is CC0. Page images are public domain where the book is, and otherwise under a non-commercial CC licence: "You cannot use images in BHL's collection to make money ... without prior approval". BHL prefers the credit "Image courtesy of Biodiversity Heritage Library" [search: BHL copyright and reuse page]. Bulk JPEG 2000 images are on AWS open data [search].
- BHL's Flickr account holds over 150,000 illustrations. A library guide says most are public domain and each image shows its status; an older blog says CC BY 2.0. Check the label per image [search].
- Coverage: natural-history plates of animals, birds, insects and plants. Excellent for structure studies and engraving-style line.

Flickr API
- Key required. Applicants choose a non-commercial or commercial key, and Flickr reviews apps for compliance with the API Terms [search: flickrhelp.com]. Commercial use needs prior permission [search]. Downloads larger than 1024 px from free accounts are restricted through the API [search].
- Licence IDs used by Openverse: 1 CC BY-NC-SA 2.0, 2 CC BY-NC 2.0, 3 CC BY-NC-ND 2.0, 4 CC BY 2.0, 5 CC BY-SA 2.0, 6 CC BY-ND 2.0, 9 CC0, 10 Public Domain Mark. Its notes give a rate limit of 3,600 requests an hour [opened: Openverse Flickr script]. ID 7 "No known copyright restrictions" (Flickr Commons) and ID 8 "United States Government Work" also exist [unconfirmed].
- The API terms' rules on linking back to the photo page and on storing photos were not seen [search found nothing]. My understanding is that they require a link to the photo page and limit long-term storage [unconfirmed]. Use short-lived caching and always link to the photo page.

iNaturalist API
- Read endpoints such as `https://api.inaturalist.org/v1/observations?photo_license=cc0,cc-by,cc-by-sa&quality_grade=research&taxon_name=...` [unconfirmed parameter names; the API docs page was not reachable].
- Practice rules: about one request a second and about 10,000 a day. The hard throttle is 100 a minute, and iNaturalist asks for 60 or fewer. Downloading more than 5 GB of media an hour or 24 GB a day may get a permanent block [search: iNaturalist API Recommended Practices and Developers pages]. Openverse notes "The iNaturalist API is not intended for data scraping" and uses the `inaturalist-open-data` S3 bucket instead [opened].
- Photo licences: CC0, CC BY, CC BY-SA, CC BY-NC (the default for new users), CC BY-ND, CC BY-NC-SA, CC BY-NC-ND, or all rights reserved. A January 2024 count put CC BY-NC at about 52 percent and all rights reserved at about 47 percent [search: iNaturalist community posts].
- Which licences permit display: every CC licence permits showing the unmodified photo with attribution. For a personal, non-commercial viewer, allow CC0, CC BY, CC BY-SA, CC BY-NC and CC BY-NC-SA. Leave out the ND variants so nobody has to argue about whether the grayscale and blur tools count as adaptations. Never show all-rights-reserved photos.
- Coverage: every animal and plant group, photographed in the field. Many photos are small, cropped or poorly lit. Filter to research grade and prefer larger originals.

Unsplash API
- Access Key required. Demo mode allows 50 requests an hour and suits "small personal projects not intended for the public". Production allows 5,000 an hour after approval [search: unsplash.com/documentation and help centre].
- Required by the API guidelines: use the hotlinked `photo.urls` "for every use of the image"; call `photo.links.download_location` when the user uses a photo; and credit "Unsplash, the Unsplash photographer" with a profile link carrying `?utm_source=your_app_name&utm_medium=referral` [search: help.unsplash.com API guidelines; opened: unsplash-js README lists "hotlink images", "attribute photographers" and "trigger a download when appropriate"].
- Keys: "Access Key and Secret Key must remain confidential. This may require using a proxy if accessing the API client-side." [search]. The JS client says browsers "must proxy your requests through your server ... keeps your keys confidential" [opened]. Sharing credentials with a third party is prohibited [search: API Terms via a tosdr mirror].
- Not allowed: "Replicating Unsplash's core user experience, such as through unofficial clients or wallpaper apps" [search], using the Unsplash name in the app name, or selling unaltered photos [search].
- What this means for the app: the user pastes their own Access Key. The launcher proxies the requests. Images are hotlinked and never cached. The app calls `download_location` once when a photo becomes a session reference, and the credit line links to the photographer and to Unsplash. A drawing-session viewer is a different use from a wallpaper app or an unofficial client, but keep Unsplash as one source among several rather than a browsing front-end [my reading, not a ruling].
- Coverage: high-quality photos of landscapes, architecture, objects, animals and people (portraits, sport, dance). Not pose-oriented, but searches such as "dancer", "parkour" or "jiu jitsu" give good clothed action.

Pexels API
- Key required. Default limits are 200 requests an hour and 20,000 a month, and limit increases are "currently paused" [search: Pexels help centre]. Working around the limit ends API access [search].
- Attribution: "show a prominent link to Pexels" whenever the API is used. "Photos provided by Pexels" is fine. Credit the photographer where possible, for example "Photo by John Doe on Pexels" with a link to the photo page [search: Pexels API guidelines].
- The Pexels License allows free use and modification with no attribution, but no selling unaltered copies [prior]. Rules on hotlinking and caching in the API terms were not seen [unconfirmed].
- Coverage: like Unsplash, plus video.

Pixabay API
- Key required. 100 requests per 60 seconds per key. "Requests must be cached for 24 hours." "Returned image URLs may be used for temporarily displaying search results. However, permanent hotlinking of images (using Pixabay URLs in your app) is not allowed." "Systematic mass downloads are not allowed." [search: pixabay.com/api/docs]. Third-party guides say to download chosen images to your own storage and that `webformatURL` links expire after 24 hours [search; unconfirmed]. The exact attribution wording in the docs was not seen [unconfirmed]. The usual credit is "Image by {user} from Pixabay" with a link [unconfirmed].
- What this means for the app: cache every API response for 24 hours. When an image becomes a session reference, download it into the local cache and show it from there. Keep the Pixabay page link and the user name.
- Coverage: photos, illustrations and vectors, with many animals, plants and objects. Quality varies.

NASA Image and Video Library
- Search endpoint `https://images-api.nasa.gov/search` [unconfirmed: the search did not reach the API docs, including whether a key is needed].
- NASA media "generally are not subject to copyright in the United States". Commercial use must not suggest NASA endorsement. A recognisable person may raise publicity rights for commercial use. Third-party copyrighted items are marked with the holder's name, and NASA logos and the seal are excluded [search: NASA media guidelines].
- Coverage: rockets, spacecraft and aircraft (good hard-surface and vehicle studies), Earth landscapes from orbit, and astronauts. Useful for random prompts.

Figure and pose sites
- Line of Action: no public API found [search]. Photographers licensed their images for educational use within the website [search, a third-party blog]. The FAQ says images are licensed for educational use inside the tools, and that you may post your drawings but not sell them [prior]. The About page forbids scraping and AI training [search]. Free tools with ads; memberships from USD 1.49 a month [prior]. Hosts nude and clothed photos [prior]. Verdict: link out.
- Quickposes: the library page says its images "are all copyrighted" and may be used only for practice or inspiration [search]. Optional tips and a 15-euro desktop app [prior]. Verdict: link out.
- SketchDaily (sketchdaily.net): a script-driven app; free per two secondary sources; no licence stated [prior]. No API found [search returned nothing]. Verdict: link out.
- Croquis Cafe: videos of live models on the On Air Video YouTube channel. Some contain nudity and need a signed-in account. A forum thread says the material is now subscription only, about USD 36 a year (undated) [search]. Verdict: link out.
- Posemaniacs: 3D pose references called royalty free; terms page not read [prior]. Search found no terms [search]. Verdict: link out.
- Character Design References: a website with a Patreon that upgrades a free Character Design Challenge membership; prices not shown [search]. Verdict: link out.
- Proko Timer: free sample packs (2,500+ images) and paid packs from USD 5 to 229, credited to photographers. Some packs are tagged NUDE. The site carries a NoAI tag [prior]. Verdict: link out.
- AdorkaStock (formerly SenshiStock): images are under CC BY 3.0. Attribution is waived when the photo is used only as reference and none of it appears in the final work. Sharing is allowed with credit and a live hyperlink to the DeviantArt account. International use is allowed under the artist's rules [search: AdorkaStock FAQ and licence journal, rules updated December 2021, FAQ May 2024]. No API. Verdict: a hand-picked local pack is legal if each image keeps its credit and link. Linking out is simpler.

### Recommended source mix per session type

Each session draws from in-app sources in the order listed, with a "more poses" button that opens the link-out sites.

| Session | In-app sources (order of preference) | Filters | Link-out buttons |
|---|---|---|---|
| Gesture, people | 1) Muybridge human motion plates (Commons, public domain). 2) Figure drawings and academic studies from AIC, Met, Cleveland and Rijksmuseum. 3) Unsplash or Pexels with the user's key: dance, sport, martial arts, jiu jitsu, yoga, parkour. 4) Commons sport and dance categories via the licence allow-list. 5) Optional AdorkaStock local pack. | public domain or CC0 for museums; Commons allow-list; a nudity toggle (museum nudes are common) | Line of Action, Quickposes, Proko Timer free packs, SketchDaily, Love Life Drawing, NMA Daily Life Drawing |
| Gesture, animals | 1) iNaturalist research-grade photos with licences CC0, CC BY, CC BY-SA, CC BY-NC or CC BY-NC-SA, by taxon (dogs, cats, horses, birds). 2) Muybridge Animal Locomotion (Commons). 3) Unsplash, Pexels or Pixabay animals. 4) Commons animal categories. | taxon filter, minimum image width | Line of Action animals, Quickposes animals, explore.org live cams, Aaron Blaise videos |
| Still life and objects | 1) Cleveland and Met CC0 decorative arts (ceramics, glass, metalwork, armour for ellipses and reflective surfaces). 2) Smithsonian CC0 (design objects, tools; key). 3) Unsplash or Pexels "still life", "tools", "kitchen". 4) NASA hardware. | classification filters such as Ceramics, Metalwork, Glass | none needed |
| Nature (plants and landscapes) | 1) iNaturalist plants and fungi. 2) Commons landscapes and plants (allow-list). 3) Unsplash or Pexels landscapes. 4) BHL botanical and zoological plates (via Flickr or Commons, or the BHL API with a key). 5) Museum landscape paintings and Japanese prints (AIC, Met). | prefer large images | explore.org cams |
| Architecture | 1) Library of Congress architecture photographs and measured drawings (no-known-restrictions only). 2) Commons architecture (allow-list). 3) Unsplash or Pexels architecture. 4) Architectural prints and drawings (Rijksmuseum, Met, AIC). | 20 JSON requests a minute for LoC | none needed |
| Master copies | 1) AIC IIIF at 843 px. 2) Met and Cleveland CC0. 3) NGA from a local CSV index (drawings, prints). 4) Rijksmuseum public domain. 5) Getty CC0. 6) Smithsonian CC0 art (key). 7) Commons public-domain art for gaps. | prefer drawings and prints for line copies; paintings for value copies with the grayscale tool | museum pages via the credit link |
| Random prompts | Weighted random pick across the above, plus Openverse search on a random word (with the Openverse notice) and NASA | same licence filters | none |

### Attribution string format

Show one line at the edge of the viewer. Tapping it opens the landing page.

Default pattern: `"{title}" by {creator}, {date} | {source} | {licence}`, where `{licence}` links to the licence URL when there is one.

Per-source wording:
- CC0 or public-domain museums: `"{title}" by {artist}, {date} | {Museum}, {credit line} | Public domain (CC0)`. Do not use museum logos or suggest endorsement.
- Wikimedia Commons: `{Artist, HTML stripped} | {LicenseShortName} | via Wikimedia Commons`, linking the licence to `LicenseUrl` and the line to the file page.
- Openverse: the API's `attribution` string, plus a fixed footer in settings or about: "Made using Openverse. Not endorsed or certified by Openverse."
- iNaturalist: `(c) {observer}, {licence code} | iNaturalist observation {id}`, linking to the observation.
- Flickr: `"{title}" by {owner} | {licence} | Flickr`, linking to the photo page.
- Unsplash: `Photo by {name} on Unsplash`, linking both names with `?utm_source={app_name}&utm_medium=referral`.
- Pexels: `Photo by {name} on Pexels`, linking to the photo page, plus "Photos provided by Pexels" in the source picker.
- Pixabay: `Image by {user} from Pixabay`, linking to `pageURL`.
- BHL: `Image courtesy of Biodiversity Heritage Library | {book title}, {year} | {licence}`.
- Library of Congress: `"{title}", {creator}, {date} | Library of Congress | {rights advisory}`.
- NASA: `{title} | NASA | Public domain in the US; no NASA endorsement implied`.
- AdorkaStock: `Pose by AdorkaStock (CC BY 3.0)`, with a live link to the AdorkaStock DeviantArt account.

Store the credit with the image record: `source`, `id`, `title`, `creator`, `creator_url`, `date`, `licence_code`, `licence_url`, `landing_url`, `image_url`, `attribution`, `fetched_at`, `rights_checked_at`. Never show an image whose credit fields are missing.

A note on the viewer tools: flip, grayscale, grid and blur change only what this user sees on their own device for study, and the app does not redistribute the result. That is why ND licences are left out rather than relied on. If the app ever exports or shares a filtered image, add "modified" to the credit (CC BY 4.0 asks you to indicate changes when you share).

### Caching policy

| Source group | Image files | Metadata | Refresh | Notes |
|---|---|---|---|---|
| CC0 and public-domain museums (Met, AIC, Cleveland, NGA, Rijksmuseum public domain, Getty CC0, Smithsonian CC0), NASA, LoC no-known-restrictions items | cache indefinitely | cache indefinitely | re-check the rights flag monthly | AIC at most 1 req/s; LoC at most 20 JSON req/min; Smithsonian 1,000/hour per key |
| Wikimedia Commons, Openverse, iNaturalist, Rijksmuseum CC BY, Europeana open, BHL | cache with the credit stored beside the file | cache | re-check the licence every 90 days | Openverse: cache only what the user viewed, never scrape; iNaturalist: no bulk, stay well under 5 GB an hour |
| Flickr | short-lived cache, for example the session | cache IDs and credits | re-fetch per session | API terms on storage unconfirmed; always link to the photo page |
| Unsplash | never cache files; always hotlink `photo.urls` | keep only IDs and credits | re-request when shown | call `download_location` once per session use; works online only |
| Pixabay | download the chosen image into the local cache | cache API responses for 24 hours (required) | after 24 hours | no permanent hotlinking, no mass downloads |
| Pexels | cache chosen images with credit (licence allows) | cache | 30 days | API caching terms unconfirmed; check before release |
| Pose sites (Line of Action, Quickposes, SketchDaily and others) | none | none | none | link out only |

Implementation notes:
- Put every network call in the Electron launcher. It holds the user's keys, sets a real User-Agent (for Wikimedia) and the `AIC-User-Agent` header, and rate-limits per source. The phone talks to the launcher. This matches Unsplash's advice to proxy rather than expose keys.
- Keys live in a local settings file outside the repo. Add the settings file to `.gitignore` and ship an example with empty values.
- Add a per-source "safe content" toggle. Museums, Commons and the pose sites all include nudes.

## Part B: art websites, teachers and communities to point to

Phases: 1 setup, 2 marks and gesture, 3 seeing and measuring, 4 perspective and construction, 5 light and value, 6 figure and head, 7 objects and nature, 8 scenes and composition, 9 characters and invention, 10 colour and media.

"Reachable 2026-10-13" means the earlier link check got HTTP 200 that day. It does not prove recent uploads.

### Structured free courses

| Name | URL | Best for | Phases | Cost | Active 2026 | Credit line |
|---|---|---|---|---|---|---|
| Drawabox | https://drawabox.com/ | lines, ellipses, boxes, then construction of plants, insects, animals, objects and vehicles; 250 box challenge | 2, 4, 7 | lessons free; community critique paid (unconfirmed) | reachable 2026-10-13; content unreadable to tools [prior] | Drawabox, by Irshad Karim ("Uncomfortable") (name unconfirmed) |
| Ctrl+Paint | https://www.ctrlpaint.com/ | short videos on line, form, value, composition, thumbnails and digital painting | 1, 2, 5, 8, 9, 10 | free library; extra videos USD 10 each [prior] | reachable 2026-10-13; new uploads not seen | Ctrl+Paint, by Matt Kohr |
| Proko free lessons | https://www.proko.com/ | gesture, figure, anatomy (115 free lessons), Loomis head, perspective (Marshall Vandruff), shading | 2, 3, 4, 5, 6 | free tier; full courses about USD 125 to 150 | yes: "Best Of 2025" pack seen, pages reachable 2026-10-13 [prior] | Proko, Stan Prokopenko and guest instructors |
| Pixar in a Box (Khan Academy) | https://www.khanacademy.org/partner-content/pixar | virtual lighting, storytelling, rendering | 5, 8, 9 | free | reachable 2026-10-13; unit list unverified [prior] | Pixar Animation Studios and Khan Academy |
| OpenLearn Create: Drawing and Coloring Essentials | https://www.open.edu/openlearncreate/course/view.php?id=4322 | 24-hour beginner course: objects, figure, portrait, still life, landscape | 1, 3, 6, 7, 10 | free (account likely) | existed per earlier pass; link check blocked [prior] | The Open University, OpenLearn Create |
| Line of Action: learn to draw | https://www.line-of-action.com/learn-to-draw | 15-minute gesture tutorial (line of action, masses, limbs) | 2, 6 | free | reachable 2026-10-13 [prior] | Line of Action |
| New Masters Academy free sessions | https://www.nma.art/courses/daily-life-drawing-sessions/ | timed 1, 2, 5 and 10 minute life-drawing videos | 2, 6 | free or sign-up (pages conflict) [prior] | reachable 2026-10-13 [prior] | New Masters Academy instructors |

### YouTube and video teachers

Channel URLs are given where the earlier pass confirmed them. Otherwise the URL is a YouTube search, because I could not confirm the handle.

| Name | URL | Best for | Phases | Cost | Active 2026 | Credit line |
|---|---|---|---|---|---|---|
| Proko (YouTube) | https://www.youtube.com/@ProkoTV | figure, anatomy, portrait, interviews | 2, 5, 6 | free | channel exists [prior]; last upload not seen | Proko, Stan Prokopenko |
| Draftsmen podcast | https://proko.com/369 (example episode) | long-form Q&A on learning to draw (Stan Prokopenko and Marshall Vandruff) | 1, 3, 4, 6 | free; premium cuts exist [prior] | not confirmed | Draftsmen, Stan Prokopenko and Marshall Vandruff |
| Marco Bucci | https://www.youtube.com/@MarcoBucci | values, edges, light, colour, painting thinking | 5, 8, 10 | free; paid courses elsewhere | channel reachable 2026-10-13 [prior] | Marco Bucci |
| Alphonso Dunn | https://www.youtube.com/@AlphonsoDunn | pen and ink, hatching, textures, trees, landscapes, perspective | 2, 4, 5, 7, 10 | free; books and courses paid | reachable 2026-10-13 [prior] | Alphonso Dunn |
| James Gurney | https://www.youtube.com/@JamesGurney and https://gurneyjourney.blogspot.com/ | plein air, gouache, light and colour, imaginative realism | 5, 7, 8, 10 | free; video courses paid | yes: blog post dated January 2026 [prior] | James Gurney |
| Feng Zhu / FZD School (Design Cinema) | https://www.youtube.com/@FZDSchool and https://www.fzdschool.com/ | perspective, environments, vehicles, design thinking | 4, 8, 9 | free videos; school paid | reachable 2026-10-13 [prior] | Feng Zhu, FZD School of Design |
| Aaron Blaise | https://creatureartteacher.com/ (YouTube: The Art of Aaron Blaise) | animal anatomy and gesture, creature design | 2, 7, 9 | free videos; courses paid | yes: Inktober 2026 list posted 1 Oct 2026 on his site [prior] | Aaron Blaise, The Art of Aaron Blaise |
| Love Life Drawing | https://www.lovelifedrawing.com | figure references, quick-sketch timer, life drawing sessions | 2, 6 | joining free; courses priced on site [prior] | site opened in earlier pass; date not seen | Love Life Drawing |
| Sinix Design | https://www.youtube.com/@SinixDesign | digital painting, anatomy and design explainers | 6, 9, 10 | free | channel exists [prior]; recent uploads not seen | Sinix Design |
| Watts Atelier | https://www.youtube.com/results?search_query=Watts+Atelier | atelier fundamentals, head and figure construction | 3, 5, 6 | free videos; online school paid [unconfirmed] | not checked | Watts Atelier of the Arts, Jeff Watts |
| Ahmed Aldoori | https://www.youtube.com/results?search_query=Ahmed+Aldoori | fundamentals, value, studies, mindset | 3, 5, 6, 10 | free; courses paid [unconfirmed] | not checked | Ahmed Aldoori |
| Mark Crilley | https://www.youtube.com/results?search_query=Mark+Crilley+drawing | manga and comic faces, step-by-step demos | 6, 9 | free [unconfirmed] | not checked | Mark Crilley |
| Ethan Becker | https://www.youtube.com/results?search_query=Ethan+Becker+drawing | construction and form analysis | 4, 6 | free [unconfirmed] | not checked; may be inactive [unconfirmed] | Ethan Becker |
| Sycra | https://www.youtube.com/results?search_query=Sycra+art | anatomy, digital painting, study methods | 5, 6, 10 | free [unconfirmed] | not checked; uploads believed sparse in recent years [unconfirmed] | Sycra Yasin |
| Kienan Lafferty | https://www.youtube.com/results?search_query=Kienan+Lafferty | sketchbook practice, motivation, study routines | 1, 2 | free [unconfirmed] | not checked | Kienan Lafferty |
| Moderndayjames | https://www.youtube.com/results?search_query=Moderndayjames | improvement journeys, practice ideas | 1, 2 | free [unconfirmed] | not checked; may be inactive [unconfirmed] | Moderndayjames |
| Marc Brunet | https://www.youtube.com/results?search_query=Marc+Brunet+art | digital art career and fundamentals | 1, 9, 10 | free; paid online programme [unconfirmed] | not checked | Marc Brunet |
| Jesse Hamm | https://www.youtube.com/results?search_query=Jesse+Hamm+comics | comics drawing, simplification, clear line | 6, 8, 9 | free [unconfirmed] | not checked | Jesse Hamm |
| Teoh Yi Chie (Parka Blogs) | https://www.parkablogs.com/ | reviews of art books, tablets and media | 1, 10 | free | Parka Blogs page cited in earlier pass; date not seen | Teoh Yi Chie, Parka Blogs |
| Sorie Kim | https://www.youtube.com/results?search_query=Sorie+Kim | sketchbooks, character and figure | 6, 9 | free [unconfirmed] | not checked | Sorie Kim |
| Toniko Pantoja | https://www.youtube.com/results?search_query=Toniko+Pantoja | figure, gesture, illustration teaching | 2, 6, 9 | free [unconfirmed] | not checked | Toniko Pantoja |
| Eric Strebel | https://www.youtube.com/@EricStrebel | industrial design sketching of objects | 4, 7 | free | channel reachable 2026-10-13 [prior] | Eric Strebel |
| Urban Sketchers talks | https://urbansketchers.org/usk-talks/ | on-location drawing, scenes | 7, 8, 10 | free | reachable 2026-10-13 [prior] | Urban Sketchers |

### Inspiration and portfolios

| Name | URL | Best for | Phases | Cost | Active 2026 | Credit line |
|---|---|---|---|---|---|---|
| ArtStation | https://www.artstation.com/ | professional concept art and illustration portfolios | 8, 9, 10 | free to browse | page opened in earlier pass; no date [prior] | ArtStation (Epic Games) (owner unconfirmed) |
| Behance | https://www.behance.net/ | illustration and design portfolios | 8, 9, 10 | free to browse [unconfirmed] | not checked | Behance (Adobe) |
| Museum open-access collections (Met, AIC, Rijksmuseum, NGA, Cleveland) | https://www.metmuseum.org/art/collection and others | master studies, composition, drawing technique | 3, 5, 8, 10 | free | in-app sources above | the museum named on each work |
| Kim Jung Gi official channels | https://www.youtube.com/results?search_query=Kim+Jung+Gi+official | sketchbook drawing from imagination, perspective and figures | 4, 8, 9 | free to watch; books paid [unconfirmed] | not checked | Kim Jung Gi (1975 to 2022), official estate channels |
| Gurney Journey | https://gurneyjourney.blogspot.com/ | daily posts on perception, light, sketching | 3, 5, 7, 8 | free | yes, January 2026 post [prior] | James Gurney |
| Muddy Colors | https://www.muddycolors.com | illustration craft articles by working artists | 8, 9, 10 | free | post dated December 2025 seen [prior] | Muddy Colors contributors |
| Lines and Colors | https://linesandcolors.com/ | art blog on drawing, painting and illustration | 3, 8, 10 | free | article page reachable 2026-10-13 [prior] | Charley Parker, Lines and Colors (author unconfirmed) |

### Critique communities

| Name | URL | Best for | Phases | Cost | Active 2026 | Credit line |
|---|---|---|---|---|---|---|
| r/ArtFundamentals | https://www.reddit.com/r/ArtFundamentals/ | Drawabox homework and critique | 2, 4, 7 | free (Reddit account) | not confirmed [prior] | r/ArtFundamentals members |
| r/learnart | https://www.reddit.com/r/learnart/ | beginner questions and critique | all | free (Reddit account) | front page read through a mirror, undated [prior] | r/learnart members |
| r/ArtCrit | https://www.reddit.com/r/ArtCrit/ | focused critique of finished pieces | 5, 8, 10 | free (Reddit account) | read through a mirror, undated [prior] | r/ArtCrit members |
| Drawabox Discord | linked from https://drawabox.com/ | peer help on Drawabox lessons | 2, 4, 7 | free [unconfirmed] | not checked | Drawabox community |
| Proko community | https://www.proko.com/community | fundamentals, anatomy and concept design forums; challenges | 2 to 9 | free to read; posting terms unconfirmed [prior] | reachable 2026-10-13 [prior] | Proko community members |
| Line of Action forums | https://line-of-action.com/ (Discuss menu) | critique, practice advice, study groups | 2, 6 | free; paid tiers add critique uploads [prior] | reachable 2026-10-13 [prior] | Line of Action community |
| Krita Artists | https://krita-artists.org/ | digital painting help and feedback | 1, 10 | free | reachable 2026-10-13 [prior] | Krita Artists community |
| ConceptArt.org forums | none (do not link) | historically the main concept-art forum | none | none | believed offline for several years [unconfirmed] | ConceptArt.org (historical) |

### Challenges and prompts

| Name | URL | Best for | Phases | Cost | Active 2026 | Credit line |
|---|---|---|---|---|---|---|
| Inktober | https://inktober.com/ | 31 daily ink drawings in October | 2, 5, 9, 10 | free to join | yes: official 2026 prompt list posted 1 Sep 2026 on SVSLearn [prior] | Inktober, created by Jake Parker |
| Aaron Blaise unofficial Inktober list | https://creatureartteacher.com/ink-prompts-2026/ | creature-focused October prompts | 7, 9 | free (view only) | yes, posted 1 Oct 2026 [prior] | posted by Nick Burch on Aaron Blaise's site |
| Peachtober and other October lists | https://www.instagram.com/explore/tags/peachtober/ | alternative October prompt lists | 9 | free [unconfirmed] | not checked | the list's creator as named on the list |
| SketchDaily | https://www.sketchdaily.net/ and https://www.reddit.com/r/SketchDaily/ | timed references (site) and a daily theme (subreddit, unconfirmed) | 2, 6, 9 | free | site existed per earlier pass; subreddit not checked | SketchDaily |
| 100 heads challenge | https://www.instagram.com/explore/tags/100heads/ | 100 heads in about 10 days | 6 | free [unconfirmed] | not checked | community challenge; origin not confirmed |
| Proko 2 Week Drawing Challenge | https://www.proko.com/course-lesson/2-week-drawing-challenge | short habit challenge | 1, 2 | free tier | reachable 2026-10-13 [prior] | Proko |
| USk Prompts | https://urbansketchers.org/usk-prompts/ | monthly daily sketching prompts from life | 7, 8 | free | reachable 2026-10-13 [prior] | Urban Sketchers |
| Character Design Challenge | https://characterdesignreferences.com/ | monthly character design theme | 9 | free with paid Patreon upgrades [search] | not checked | Character Design References |

### References for specific subjects

| Name | URL | Best for | Phases | Cost | Active 2026 | Credit line |
|---|---|---|---|---|---|---|
| Line of Action | https://line-of-action.com/ | timed figures, animals, hands, faces, 360 views | 2, 6, 7 | free with ads; paid from USD 1.49 a month | reachable 2026-10-13 [prior] | Line of Action (Genly Inc) |
| Quickposes | https://quickposes.com/en/ | timed gesture, 20-image challenges | 2, 6 | free; optional tips and app | reachable 2026-10-13 [prior] | Quickposes |
| Proko Timer | https://www.proko.com/timer | timed sessions from free sample packs | 2, 6 | free samples; paid packs USD 5 to 229 | "Best Of 2025" pack seen [prior] | Proko and the credited photographers |
| Posemaniacs | https://www.posemaniacs.com/ | 3D poses, muscles, hands, faces | 4, 6 | free (pricing not stated) | reachable 2026-10-13 [prior] | Posemaniacs |
| AdorkaStock | https://adorkastock.com/ | free pose photos under CC BY 3.0 | 2, 6 | free; packs and Patreon paid | FAQ updated May 2024 [search]; home blocked to link check [prior] | AdorkaStock, Sarah Forde |
| Character Design References | https://characterdesignreferences.com/ | curated character design sheets and animation galleries | 9 | free tier plus Patreon [search] | not checked | Character Design References |
| Croquis Cafe | https://www.youtube.com/results?search_query=Croquis+Cafe | filmed model poses (nudity) | 2, 6 | mostly membership [search] | not checked | Croquis Cafe, On Air Video |
| explore.org live cams | https://explore.org/livecams | live animal video for gesture | 2, 7 | free | reachable 2026-10-13 [prior] | explore.org |
| Muybridge Animal Locomotion (Commons) | https://commons.wikimedia.org/wiki/Category:Animal_Locomotion | sequential animal and human motion | 2, 6, 7 | free (public domain) | category reachable 2026-10-13 [prior] | Eadweard Muybridge, via Wikimedia Commons |
| iNaturalist | https://www.inaturalist.org/ | animal and plant photos with CC licences | 7 | free | not checked | iNaturalist observers |
| Biodiversity Heritage Library | https://www.biodiversitylibrary.org/ | natural-history plates | 7 | free | not checked | Biodiversity Heritage Library |

### Quality and conduct flags

- Inktober: the founder and the event drew public criticism in 2019 and 2020 over trademark enforcement and a plagiarism allegation about a book [unconfirmed; check before citing]. Taking part is still fine. Alternative lists exist if the user prefers.
- ArtStation: in 2022 artists protested AI-generated images on the platform [unconfirmed]. Expect AI images in feeds.
- Drawabox: some learners find the workload and strictness discouraging [unconfirmed]. Pair it with observational drawing rather than doing it alone.
- Nudity: Line of Action, Proko Timer, Love Life Drawing, Croquis Cafe, NMA and museum collections include nude models or artworks. Use their filters.
- Kim Jung Gi died in 2022 [unconfirmed]. Unofficial reuploads and AI imitations of his style circulate, so link only to official estate or publisher channels.
- Possibly inactive channels: Sycra, Ethan Becker and Moderndayjames [unconfirmed]. Older videos remain useful.
- Marc Brunet's videos promote his paid programme [unconfirmed]. That is a marketing note, not a conduct concern.
- ConceptArt.org: do not link. The forums are believed to be offline [unconfirmed].
- Reddit critique quality varies by who answers. Read each subreddit's posting rules.

### The 15 most valuable to point to

1. Drawabox (lessons, r/ArtFundamentals, Discord): phases 2, 4, 7.
2. Proko (free lessons, Timer, Draftsmen, community): phases 2 to 6.
3. Ctrl+Paint: phases 1, 2, 5, 8, 10.
4. Line of Action: phases 2, 6, 7.
5. Quickposes: phases 2, 6.
6. Marco Bucci: phases 5, 8, 10.
7. Alphonso Dunn: phases 2, 4, 5, 7, 10.
8. James Gurney (YouTube and Gurney Journey): phases 3, 5, 7, 8, 10.
9. FZD Design Cinema (Feng Zhu): phases 4, 8, 9.
10. Aaron Blaise: phases 2, 7, 9.
11. Love Life Drawing: phases 2, 6.
12. Watts Atelier (YouTube): phases 3, 5, 6 (activity not checked).
13. r/learnart and r/ArtCrit: critique in all phases.
14. Urban Sketchers (talks and USk Prompts): phases 7, 8.
15. Inktober, with the official list: phases 2, 9, 10.

## Sources

Opened in this pass:
- https://raw.githubusercontent.com/metmuseum/openaccess/master/README.md
- https://raw.githubusercontent.com/ClevelandMuseumArt/openaccess/master/README.md
- https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/README.md
- https://raw.githubusercontent.com/Smithsonian/OpenAccess/master/README.md
- https://raw.githubusercontent.com/art-institute-of-chicago/api-data/master/README.md
- https://github.com/art-institute-of-chicago/data-aggregator and https://raw.githubusercontent.com/art-institute-of-chicago/data-aggregator/main/docs/.sections/preface.md
- https://raw.githubusercontent.com/unsplash/unsplash-js/master/README.md
- https://raw.githubusercontent.com/inaturalist/iNaturalistAPI/main/README.md (no rate or licence detail)
- https://raw.githubusercontent.com/WordPress/openverse/main/api/conf/settings/rest_framework.py
- https://raw.githubusercontent.com/WordPress/openverse/main/api/api/serializers/media_serializers.py
- https://raw.githubusercontent.com/WordPress/openverse/main/documentation/terms_of_service.md
- Openverse provider scripts: metropolitan_museum.py, cleveland_museum.py, smithsonian.py, europeana.py, flickr.py, wikimedia_commons.py, inaturalist.py under https://github.com/WordPress/openverse/tree/main/catalog/dags/providers/provider_api_scripts
- https://raw.githubusercontent.com/wikimedia/mediawiki-extensions-CommonsMetadata/master/src/TemplateParser.php and .../src/DataCollector.php

Seen only through search-result text (not opened): metmuseum.github.io; api.artic.edu/docs; data.rijksmuseum.nl/docs/search; openaccess-api.clevelandart.org; api.data.gov/docs/rate-limits; nga.gov/artworks/free-images-and-open-access; data.getty.edu/museum/collection/docs; getty.edu Open Content FAQs; europeana.atlassian.net API FAQ and Search API docs; commons.wikimedia.org Commons:Machine-readable data, Commons:Credit line, Commons:Reusing content outside Wikimedia/technical; mediawiki.org API:Imageinfo and Extension:CommonsMetadata; loc.gov/apis/json-and-yaml/working-within-limits and /requests; biodiversitylibrary.org/docs/api3.html; about.biodiversitylibrary.org copyright and reuse; flickrhelp.com Flickr API; inaturalist.org/pages/api+recommended+practices and /pages/developers; iNaturalist licensing posts; help.unsplash.com API guidelines and rate-limit article; unsplash.com/documentation; help.pexels.com rate-limit articles; pexels.com/api; pixabay.com/api/docs; nasa.gov brand centre images and media; ASDC copyright page; line-of-action.com About and Photographers; quickposes.com/en/library; adorkastock.com/faq and the AdorkaStock licence journal on DeviantArt; downthetubes.net SenshiStock article; wetcanvas.com Croquis Cafe thread; parkablogs.com Croquis Cafe post; Character Design Challenge Patreon.

From the earlier pass (handoff notes, 2026-10-13): curriculum.json `library` and `resources`, link_check.json, and the source notes 05 and 09.
