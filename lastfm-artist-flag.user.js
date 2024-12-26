// ==UserScript==
// @name				Last.fm - add flags next to artist names
// @version			1.0
// @description	Adds flag emojis next to artist names on Last.fm profile pages based on MusicBrainz data.
// @author			54ac
// @namespace		https://github.com/54ac
// @match				https://www.last.fm/user/*
// @run-at			document-idle
// @grant				GM.getValue
// @grant				GM.setValue
// @icon				https://www.last.fm/favicon.ico
// @updateURL		https://raw.githubusercontent.com/54ac/lastfm-artist-flag/master/lastfm-artist-flag.user.js
// @downloadURL	https://raw.githubusercontent.com/54ac/lastfm-artist-flag/master/lastfm-artist-flag.user.js
// ==/UserScript==

/*
	"artist name": "country code", e.g.

	const overrideFlagDb = {
		"The Radio Dept.": "SE",
		"Cypress Hill": "US"
	};
*/
const overrideFlagDb = {};

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
	return flagEl;
};

const artistQueue = [];
let fetching = false;

const mainObserver = new MutationObserver(async () => {
	const flagDb = (await GM.getValue("flagDb")) || {};

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
		const artistName = artistQueue[0];
		fetching = true;

		const mbQuery = await fetch(
			`https://musicbrainz.org/ws/2/artist/?fmt=json&limit=1&query=${encodeURIComponent(
				artistName
			)}`
		)
			.then((res) => res.json())
			.catch((err) => console.error(err));

		if (mbQuery && mbQuery.artists?.length) {
			const mbArtist = mbQuery.artists[0];
			flagDb[artistName] = mbArtist.country || null;
			if (flagDb[artistName] === "XW") flagDb[artistName] = null;

			GM.setValue("flagDb", flagDb);

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
