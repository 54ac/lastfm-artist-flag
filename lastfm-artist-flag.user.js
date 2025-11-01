// ==UserScript==
// @name				Last.fm - add flags next to artist names
// @version			1.2
// @description	Adds flag emojis next to artist names on Last.fm profile pages based on MusicBrainz data.
// @author			54ac
// @namespace		https://github.com/54ac
// @match				https://www.last.fm/user/*
// @run-at			document-idle
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_deleteValue
// @grant       GM_registerMenuCommand
// @grant       GM_unregisterMenuCommand
// @grant       GM_addValueChangeListener
// @require     https://github.com/PRO-2684/GM_config/releases/download/v1.2.2/config.min.js#md5=c45f9b0d19ba69bb2d44918746c4d7ae
// @icon				https://www.last.fm/favicon.ico
// @updateURL		https://raw.githubusercontent.com/54ac/lastfm-artist-flag/master/lastfm-artist-flag.user.js
// @downloadURL	https://raw.githubusercontent.com/54ac/lastfm-artist-flag/master/lastfm-artist-flag.user.js
// ==/UserScript==

/*
"artist name": "country code", e.g.

{
	"The Radio Dept.": "SE",
	"Cypress Hill": "US"
}
*/
const configDesc = {
	overrideFlagDb: {
		name: "Override flag database",
		type: "textarea",
		value: "{}"
	}
};
const config = new GM_config(configDesc, { immediate: false });
const overrideFlagDb = JSON.parse(config.get("overrideFlagDb"));

const cssArtistSelectors = [
	".chartlist .chartlist-artist",
	"#top-artists .chartlist-name",
	"#library-sort-section[data-endpoint$='/artists'] .chartlist-name"
];

// https://dev.to/jorik/country-code-to-flag-emoji-a21
const getFlagEmoji = (countryCode) => {
	const codePoints = countryCode
		.split("")
		.map((char) => 127397 + char.charCodeAt());
	return String.fromCodePoint(...codePoints);
};

const makeFlagEl = (flag) => {
	const flagEl = document.createElement("span");
	flagEl.textContent = getFlagEmoji(flag);
	flagEl.style.marginRight = "2px";
	return flagEl;
};

const artistQueue = [];
let fetching = false;

const mainObserver = new MutationObserver(async () => {
	const flagDb = GM_getValue("flagDb") || {};

	const artistEl = document.querySelectorAll(cssArtistSelectors.join(","));

	for (const artist of Array.from(artistEl)) {
		const artistName = artist.textContent.trim();

		if (!artistName || artist.classList.contains("mb-flag")) continue;

		const flag = overrideFlagDb[artistName] || flagDb[artistName];
		if (flag !== undefined) {
			if (flag !== null) artist.prepend(makeFlagEl(flag));
			artist.classList.add("mb-flag");
		} else if (!artistQueue.includes(artistName)) artistQueue.push(artistName);
	}

	if (!artistQueue.length || fetching) return;

	while (artistQueue.length) {
		const [artistName] = artistQueue;
		fetching = true;

		const mbQuery = await fetch(
			`https://musicbrainz.org/ws/2/artist/?fmt=json&limit=1&query=${encodeURIComponent(
				artistName
			)}`
		)
			.then((res) => res.json())
			.catch((err) => console.error(err));

		if (mbQuery && mbQuery.artists?.length) {
			const [mbArtist] = mbQuery.artists;
			flagDb[artistName] = mbArtist.country || null;
			if (flagDb[artistName] === "XW") flagDb[artistName] = null;

			GM_setValue("flagDb", flagDb);

			if (flagDb[artistName] !== null) {
				for (const artist of Array.from(artistEl)) {
					if (
						artist.classList.contains("mb-flag") ||
						artist.textContent.trim() !== artistName
					)
						continue;

					artist.prepend(makeFlagEl(flagDb[artistName]));
					artist.classList.add("mb-flag");
				}
			}
		}

		artistQueue.splice(artistQueue.indexOf(artistName), 1);
		await new Promise((r) => setTimeout(r, 1100));
		if (!artistQueue.length) fetching = false;
	}
});

const mainEl = document.getElementById("content");
if (mainEl) mainObserver.observe(mainEl, { childList: true, subtree: true });
