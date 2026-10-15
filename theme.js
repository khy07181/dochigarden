// Light/dark toggle shared by the studio pages. Load it in <head> so a saved choice
// applies before first paint. With nothing saved, pages follow the system theme;
// a click saves the other theme as an explicit choice (data-theme on <html>).
(function () {
  var root = document.documentElement;
  var system = matchMedia("(prefers-color-scheme: dark)");
  var paper = { light: "#F4EFE3", dark: "#1E1B17" };

  function load() { try { return localStorage.getItem("theme"); } catch (e) { return null; } }
  function save(t) { try { localStorage.setItem("theme", t); } catch (e) {} }
  function current() { return root.dataset.theme || (system.matches ? "dark" : "light"); }

  function apply(t) {
    if (t === "light" || t === "dark") root.dataset.theme = t;
    // keep the browser chrome in step with a chosen theme, not just the system one
    if (root.dataset.theme) {
      document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
        m.content = paper[root.dataset.theme];
      });
    }
    var b = document.querySelector(".theme-toggle");
    if (b) {
      var next = current() === "dark" ? "light" : "dark";
      b.setAttribute("aria-label", "Switch to " + next + " theme");
      b.title = "Switch to " + next + " theme";
    }
  }

  var MOON = '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/></svg>';
  var SUN = '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>';
  var CSS =
    ".theme-toggle{position:fixed;top:16px;right:16px;z-index:10;width:40px;height:40px;display:grid;place-items:center;" +
    "border:1px solid var(--line);border-radius:999px;background:var(--card,var(--paper));color:var(--soft);cursor:pointer;" +
    "transition:color .18s ease,border-color .18s ease}" +
    ".theme-toggle:hover{color:var(--ink);border-color:var(--leaf)}" +
    ".theme-toggle:focus-visible{outline:2px solid var(--leaf);outline-offset:2px}" +
    ".theme-toggle svg{width:18px;height:18px}" +
    // show the moon in light (click for dark) and the sun in dark (click for light)
    ".theme-toggle .sun{display:none}" +
    "@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .theme-toggle .sun{display:block}:root:not([data-theme=light]) .theme-toggle .moon{display:none}}" +
    ":root[data-theme=dark] .theme-toggle .sun{display:block}:root[data-theme=dark] .theme-toggle .moon{display:none}";

  apply(load());

  document.addEventListener("DOMContentLoaded", function () {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    var b = document.createElement("button");
    b.type = "button";
    b.className = "theme-toggle";
    b.innerHTML = MOON + SUN;
    b.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      save(next);
      apply(next);
    });
    document.body.appendChild(b);
    apply();
  });
  system.addEventListener("change", function () { apply(); });
})();
