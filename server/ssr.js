import { createServer } from "http";
import { readFile } from "fs/promises";
import { renderToString } from "react-dom/server";

// This is a server to host CDN distributed resources like static files and SSR.

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    // send client.js script to client
    if (url.pathname === "/client.js") {
      const content = await readFile("./client.js", "utf8");
      res.setHeader("Content-Type", "text/javascript");
      res.end(content);
      return;
    }
    // fetch client JSX from RSC server
    const response = await fetch("http://127.0.0.1:8081" + url.pathname);
    if (!response.ok) {
      res.statusCode = response.status;
      res.end();
      return;
    }
    const clientJSXString = await response.text();

    if (url.searchParams.has("jsx")) {
      // subsequent navigation after initial load
      // send client JSX as a JSON string
      res.setHeader("Content-Type", "application/json");
      res.end(clientJSXString);
    } else {
      // initial load
      const clientJSX = JSON.parse(clientJSXString, parseJSX);
      let html = renderToString(clientJSX);
      // add initial client jsx string
      html += `<script>window.__INITIAL_CLIENT_JSX_STRING__ = `;
      html += JSON.stringify(clientJSXString).replace(/</g, "\\u003c");
      html += `</script>`;
      // add react and react-dom package
      // and client js script
      html += `
        <script type="importmap">
          {
            "imports": {
              "react": "https://esm.sh/react@canary",
              "react-dom/client": "https://esm.sh/react-dom@canary/client"
            }
          }
        </script>
        <script type="module" src="/client.js"></script>
      `;
      res.setHeader("Content-Type", "text/html");
      res.end(html);
    }
  } catch (err) {
    console.error(err);
    res.statusCode = err.statusCode ?? 500;
    res.end();
  }
}).listen(8080);

// helper function for json.stringfy
function parseJSX(key, value) {
  if (value === "$RE") {
    return Symbol.for("react.element");
  } else if (typeof value === "string" && value.startsWith("$$")) {
    return value.slice(1);
  } else {
    return value;
  }
}
