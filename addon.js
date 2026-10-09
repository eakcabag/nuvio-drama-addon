/**
 * Nuvio & Stremio Turkish Drama Catalog Add-on
 * Direct integration with DramaDünyam catalog, metadata and streams.
 */

const http = require("http");
const url = require("url");

const PORT = parseInt(process.env.PORT || "7070", 10);
const DD_BASE = "https://dramadunyam.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let sessionCookie = "";
let lastCookieTime = 0;

function getHeaders() {
  const headers = {
    "User-Agent": USER_AGENT,
    "Referer": DD_BASE + "/",
    "Accept": "application/json, text/plain, */*"
  };
  if (sessionCookie) {
    headers["Cookie"] = sessionCookie;
  }
  return headers;
}

function ensureSession() {
  const now = Date.now();
  if (sessionCookie && now - lastCookieTime < 18000000) {
    return Promise.resolve(getHeaders());
  }

  return fetch(DD_BASE + "/api/config", { headers: getHeaders() })
    .then(r => {
      const cookie = r.headers.get("set-cookie");
      if (cookie) {
        sessionCookie = cookie;
        lastCookieTime = Date.now();
      }
      return getHeaders();
    })
    .catch(() => getHeaders());
}

const MANIFEST = {
  id: "community.turkce.dramalar",
  version: "1.0.0",
  name: "Türkçe Asya Dramaları",
  description: "DramaDünyam ve Popüler Asya & Kore Dizileri Kataloğu (Türkçe Altyazılı)",
  types: ["series"],
  resources: ["catalog", "meta", "stream"],
  catalogs: [
    {
      type: "series",
      id: "dd_populer",
      name: "Türkçe Asya Dramaları",
      extra: [
        { name: "search", isRequired: false },
        { name: "skip", isRequired: false }
      ]
    }
  ],
  idPrefixes: ["dd:"]
};

function handleCatalog(search, skip) {
  return ensureSession().then(headers => {
    if (search) {
      const sUrl = DD_BASE + "/api/search?q=" + encodeURIComponent(search);
      return fetch(sUrl, { headers })
        .then(r => r.json())
        .then(data => {
          const items = (data && data.data) || [];
          return {
            metas: items.map(it => ({
              id: "dd:" + it.id,
              type: "series",
              name: it.title || "Dizi",
              poster: it.cover || "",
              description: (it.platform ? "[" + it.platform + "] " : "") + (it.total_episodes ? it.total_episodes + " Bölüm" : "")
            }))
          };
        });
    }

    const page = Math.floor((skip || 0) / 24) + 1;
    const lUrl = DD_BASE + "/api/series?page=" + page + "&limit=24";
    return fetch(lUrl, { headers })
      .then(r => r.json())
      .then(data => {
        const items = (data && data.data) || [];
        return {
          metas: items.map(it => ({
            id: "dd:" + it.id,
            type: "series",
            name: it.title || "Dizi",
            poster: it.cover || "",
            description: (it.platform ? "[" + it.platform + "] " : "") + (it.available_episodes ? it.available_episodes + " Bölüm Yayında" : "")
          }))
        };
      });
  }).catch(err => {
    console.error("[Addon] Catalog error:", err.message);
    return { metas: [] };
  });
}

function handleMeta(seriesId) {
  return ensureSession().then(headers => {
    const sUrl = DD_BASE + "/api/series/" + encodeURIComponent(seriesId);
    return fetch(sUrl, { headers })
      .then(r => r.json())
      .then(d => {
        const title = d.title || ("Drama " + seriesId);
        const epCount = d.available_episodes || d.total_episodes || 60;
        const videos = [];

        for (let i = 1; i <= epCount; i++) {
          videos.push({
            id: "dd:" + seriesId + ":1:" + i,
            title: "Bölüm " + i,
            season: 1,
            episode: i,
            released: d.release_date || new Date().toISOString()
          });
        }

        return {
          meta: {
            id: "dd:" + seriesId,
            type: "series",
            name: title,
            poster: d.cover || "",
            background: d.cover || "",
            description: d.description || "",
            genres: [d.genre || "Asya Dizisi", d.platform || "Drama"],
            releaseInfo: String(d.total_episodes ? d.total_episodes + " Bölüm" : ""),
            videos: videos
          }
        };
      });
  }).catch(() => {
    const videos = [];
    for (let i = 1; i <= 60; i++) {
      videos.push({
        id: "dd:" + seriesId + ":1:" + i,
        title: "Bölüm " + i,
        season: 1,
        episode: i
      });
    }
    return {
      meta: {
        id: "dd:" + seriesId,
        type: "series",
        name: "Drama " + seriesId,
        videos: videos
      }
    };
  });
}

function handleStream(seriesId, season, episode) {
  const ep = episode || 1;
  return ensureSession().then(headers => {
    const pUrl = DD_BASE + "/play/" + seriesId + "/" + ep;
    return fetch(pUrl, { headers })
      .then(r => r.json())
      .then(playData => {
        let streamUrl = playData.url;
        if (!streamUrl) {
          streamUrl = DD_BASE + "/hls/" + seriesId + "/" + ep + "/playlist.m3u8";
        } else if (streamUrl.startsWith("/")) {
          streamUrl = DD_BASE + streamUrl;
        }

        const subtitles = (playData.altyazilar || []).map(s => ({
          id: (s.dil || "tr").toLowerCase(),
          lang: s.dil === "TR" ? "tur" : (s.dil || "tur").toLowerCase(),
          url: s.src
        }));

        return {
          streams: [
            {
              title: "DramaDünyam - Bölüm " + ep + " [1080p HLS]",
              url: streamUrl,
              behaviorHints: {
                notWebReady: false,
                proxyHeaders: {
                  request: {
                    "User-Agent": USER_AGENT,
                    "Referer": DD_BASE + "/"
                  }
                }
              },
              subtitles: subtitles
            }
          ]
        };
      });
  }).catch(err => {
    console.error("[Addon] Stream error:", err.message);
    return { streams: [] };
  });
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === "/" || pathname === "/manifest.json") {
    res.writeHead(200);
    res.end(JSON.stringify(MANIFEST));
    return;
  }

  // Catalog
  const catMatch = pathname.match(/\/catalog\/([^\/]+)\/([^\/]+?)(?:\/(.*))?\.json/);
  if (catMatch) {
    const extraStr = catMatch[3] || "";
    let search = parsedUrl.searchParams.get("search");
    let skip = parseInt(parsedUrl.searchParams.get("skip") || "0", 10);

    if (extraStr.startsWith("search=")) {
      search = extraStr.replace("search=", "");
    }

    handleCatalog(search, skip).then(data => {
      res.writeHead(200);
      res.end(JSON.stringify(data));
    });
    return;
  }

  // Meta: /meta/series/dd:12345.json
  const metaMatch = pathname.match(/\/meta\/([^\/]+)\/dd:([0-9]+)\.json/);
  if (metaMatch) {
    const seriesId = metaMatch[2];
    handleMeta(seriesId).then(data => {
      res.writeHead(200);
      res.end(JSON.stringify(data));
    });
    return;
  }

  // Stream: /stream/series/dd:12345:1:2.json
  const streamMatch = pathname.match(/\/stream\/([^\/]+)\/dd:([0-9]+):([0-9]+):([0-9]+)\.json/);
  if (streamMatch) {
    const seriesId = streamMatch[2];
    const season = streamMatch[3];
    const episode = streamMatch[4];
    handleStream(seriesId, season, episode).then(data => {
      res.writeHead(200);
      res.end(JSON.stringify(data));
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🎉 Nuvio Türkçe Dramalar Katalog Eklentisi Aktif!`);
  console.log(`📡 Manifest URL: http://localhost:${PORT}/manifest.json\n`);
});
