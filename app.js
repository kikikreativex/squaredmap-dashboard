(function () {
  "use strict";

  var state = {
    loaded: { overview: false, schedule: false, ideas: false, platforms: false },
    scheduledCache: null,
    snapshotByPlatform: null
  };

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function fmtDate(d) {
    if (!d) return "";
    try { return d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return d.toString(); }
  }
  function fmtTime(d) {
    if (!d) return "";
    try { return d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; }
  }
  function daysFromNow(d) {
    var now = new Date();
    var a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((a - b) / 86400000);
  }
  function platBadgeClass(network) {
    var n = (network || "").toLowerCase();
    if (n.indexOf("insta") >= 0) return "plat-instagram";
    if (n.indexOf("face") >= 0) return "plat-facebook";
    if (n.indexOf("linked") >= 0) return "plat-linkedin";
    if (n.indexOf("tiktok") >= 0) return "plat-tiktok";
    return "plat-unknown";
  }
  function platInitials(network) {
    var n = (network || "?").toLowerCase();
    if (n.indexOf("insta") >= 0) return "IG";
    if (n.indexOf("face") >= 0) return "FB";
    if (n.indexOf("linked") >= 0) return "LI";
    if (n.indexOf("tiktok") >= 0) return "TT";
    return (network || "?").slice(0, 2).toUpperCase();
  }
  function statusPillClass(status) {
    var s = (status || "").toLowerCase();
    if (s.indexOf("idea") >= 0) return "pill-idea";
    if (s.indexOf("progress") >= 0) return "pill-progress";
    if (s.indexOf("review") >= 0) return "pill-review";
    if (s.indexOf("schedul") >= 0) return "pill-scheduled";
    if (s.indexOf("post") >= 0) return "pill-posted";
    return "pill-idea";
  }
  function emptyState(emoji, title, sub) {
    return '<div class="empty-state"><div class="emoji">' + emoji + '</div><div class="title">' + escapeHtml(title) + '</div><div class="sub">' + escapeHtml(sub || "") + '</div></div>';
  }
  function errorCard(err) {
    return '<div class="error-card">Couldn\'t load this right now (' + escapeHtml(err && err.message ? err.message : String(err)) + '). Check that your API keys are set correctly in your hosting provider\'s environment variables.</div>';
  }

  function apiGet(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error("HTTP " + r.status + ": " + t.slice(0, 200)); });
      return r.json();
    });
  }

  // ---------- data loaders ----------
  function loadScheduled(days) {
    if (state.scheduledCache) return Promise.resolve(state.scheduledCache);
    return apiGet("/api/scheduled?days=" + days).then(function (res) {
      var posts = (res.posts || []).map(function (p) {
        var d = p.date ? new Date(p.date) : null;
        return { network: p.network || "", text: p.text || "", date: d, media: p.media || null, draft: !!p.draft };
      }).filter(function (p) { return p.date; }).sort(function (a, b) { return a.date - b.date; });
      state.scheduledCache = posts;
      return posts;
    });
  }

  function loadIdeas() {
    return apiGet("/api/notion?source=ideas").then(function (res) {
      var rows = res.rows || [];
      var order = { "Idea": 0, "In Progress": 1, "Ready for Review": 2, "Scheduled": 3, "Posted": 4 };
      rows.forEach(function (r) {
        r._targetDate = r["Target Date"] ? new Date(r["Target Date"]) : null;
        r._statusOrder = order[r.Status] !== undefined ? order[r.Status] : 5;
      });
      rows.sort(function (a, b) {
        if (a._statusOrder !== b._statusOrder) return a._statusOrder - b._statusOrder;
        if (a._targetDate && b._targetDate) return a._targetDate - b._targetDate;
        return 0;
      });
      return rows;
    });
  }

  function loadSnapshot() {
    if (state.snapshotByPlatform) return Promise.resolve(state.snapshotByPlatform);
    return apiGet("/api/notion?source=snapshot").then(function (res) {
      var rows = res.rows || [];
      var byPlatform = {};
      rows.forEach(function (r) {
        var name = r.Platform;
        if (!name) return;
        (byPlatform[name] = byPlatform[name] || []).push({
          date: r["Last Updated"] ? new Date(r["Last Updated"]) : null,
          followers: r.Followers != null ? Number(r.Followers) : null,
          change: r["Change (30d)"] != null ? Number(r["Change (30d)"]) : null
        });
      });
      Object.keys(byPlatform).forEach(function (k) {
        byPlatform[k] = byPlatform[k].filter(function (r) { return r.date; }).sort(function (a, b) { return a.date - b.date; });
      });
      state.snapshotByPlatform = byPlatform;
      return byPlatform;
    });
  }

  // ---------- renderers ----------
  function renderScheduleList(container, posts, limit) {
    if (!posts.length) { container.innerHTML = emptyState("🗓️", "Nothing scheduled right now", "New posts will show up here as soon as they're queued in Metricool."); return; }
    var byDay = {}, order = [];
    posts.slice(0, limit || posts.length).forEach(function (p) {
      var key = p.date.toDateString();
      if (!byDay[key]) { byDay[key] = []; order.push(key); }
      byDay[key].push(p);
    });
    var html = "";
    order.forEach(function (key) {
      var items = byDay[key];
      var dLabel = fmtDate(items[0].date);
      var rel = daysFromNow(items[0].date);
      if (rel === 0) dLabel = "Today · " + dLabel; else if (rel === 1) dLabel = "Tomorrow · " + dLabel;
      html += '<div class="day-group"><div class="day-heading">' + escapeHtml(dLabel) + '</div>';
      items.forEach(function (p) {
        html += '<div class="item-row"><div class="plat-badge ' + platBadgeClass(p.network) + '">' + escapeHtml(platInitials(p.network)) + '</div>' +
          '<div class="item-body"><div class="item-title">' + (p.text ? escapeHtml(p.text.slice(0, 90)) + (p.text.length > 90 ? "…" : "") : "<em>No caption preview</em>") + '</div>' +
          '<div class="item-meta">' + fmtTime(p.date) + (p.draft ? " · Draft" : "") + '</div></div></div>';
      });
      html += '</div>';
    });
    container.innerHTML = html;
  }

  function renderCalendar(container, posts, monthDate) {
    monthDate = monthDate || new Date();
    var year = monthDate.getFullYear(), month = monthDate.getMonth();
    var firstDay = new Date(year, month, 1);
    var startWeekday = (firstDay.getDay() + 6) % 7;
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var monthLabel = firstDay.toLocaleDateString("en-IE", { month: "long", year: "numeric" });
    var byDate = {};
    posts.forEach(function (p) {
      if (p.date.getFullYear() === year && p.date.getMonth() === month) {
        var k = p.date.getDate();
        (byDate[k] = byDate[k] || []).push(p);
      }
    });
    var html = '<div class="cal-header"><button class="cal-nav" data-dir="-1">‹</button><div class="cal-title">' + escapeHtml(monthLabel) + '</div><button class="cal-nav" data-dir="1">›</button></div><div class="cal-grid">';
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(function (d) { html += '<div class="cal-dow">' + d + '</div>'; });
    for (var i = 0; i < startWeekday; i++) html += '<div class="cal-cell empty"></div>';
    var today = new Date();
    for (var day = 1; day <= daysInMonth; day++) {
      var isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
      var items = byDate[day] || [];
      html += '<div class="cal-cell' + (isToday ? " today" : "") + '"><div class="cal-daynum">' + day + '</div><div class="cal-dots">';
      items.slice(0, 4).forEach(function (p) {
        var title = (fmtTime(p.date) + " · " + (p.text || "no caption")).replace(/"/g, "&quot;");
        html += '<span class="cal-dot ' + platBadgeClass(p.network) + '" title="' + title + '"></span>';
      });
      if (items.length > 4) html += '<span class="cal-more">+' + (items.length - 4) + '</span>';
      html += '</div></div>';
    }
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll(".cal-nav").forEach(function (btn) {
      btn.addEventListener("click", function () { renderCalendar(container, posts, new Date(year, month + Number(btn.dataset.dir), 1)); });
    });
  }

  function renderGridPreview(container, posts) {
    if (!posts.length) { container.innerHTML = emptyState("🖼️", "Nothing to preview yet", "Once posts are scheduled, this is where you'll see how they'll look lined up together."); return; }
    var html = '<div class="ig-grid">';
    posts.forEach(function (p) {
      var hasMedia = !!p.media;
      html += '<div class="grid-tile' + (hasMedia ? "" : " no-media") + '">';
      if (hasMedia) html += '<img src="' + escapeHtml(p.media) + '" onerror="this.remove(); this.parentElement.classList.add(\'no-media\')" />';
      html += '<div class="tile-overlay"><span class="tile-plat-dot ' + platBadgeClass(p.network) + '">' + escapeHtml(platInitials(p.network)) + '</span>' +
        (p.text ? escapeHtml(p.text.slice(0, 50)) + (p.text.length > 50 ? "…" : "") : "No caption yet") + '<div class="tile-date">' + fmtDate(p.date) + '</div></div></div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function renderIdeasTable(container, rows) {
    if (!rows.length) { container.innerHTML = emptyState("💡", "No ideas logged yet", "Add rows to the SquaredMap board in Notion and they'll show up here."); return; }
    var plColors = { Instagram: "linear-gradient(135deg,#d6249f,#fa7e1e)", Facebook: "#1877F2", LinkedIn: "#0A66C2", TikTok: "#111" };
    var html = '<table class="ideas-table"><thead><tr><th>Idea</th><th>Status</th><th>Platform</th><th>Type</th><th>Notes</th><th>Target date</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var platforms = Array.isArray(r.Platform) ? r.Platform : [];
      html += "<tr><td><strong>" + escapeHtml(r.Idea || "Untitled") + "</strong></td>" +
        '<td><span class="pill ' + statusPillClass(r.Status) + '">' + escapeHtml(r.Status || "—") + "</span></td>" +
        '<td><div class="plat-tags">' + platforms.map(function (p) { return '<span class="plat-tag" style="background:' + (plColors[p] || "#888") + '">' + escapeHtml(p) + "</span>"; }).join("") + "</div></td>" +
        "<td>" + escapeHtml(r["Content Type"] || "—") + "</td>" +
        '<td style="max-width:260px;color:var(--ink-soft);">' + escapeHtml(r.Notes || "—") + "</td>" +
        "<td>" + (r._targetDate ? escapeHtml(fmtDate(r._targetDate)) : "—") + "</td></tr>";
    });
    html += "</tbody></table>";
    container.innerHTML = html;
  }

  function kpiHtml(label, value, delta, deltaClass) {
    return '<div class="kpi-card"><div class="kpi-label">' + escapeHtml(label) + '</div><div class="kpi-value">' + value + '</div>' +
      (delta ? '<div class="kpi-delta ' + deltaClass + '">' + delta + '</div>' : '') + '</div>';
  }

  var platChart;
  function renderPlatformDetail(name, byPlatform) {
    var series = byPlatform[name] || [];
    var elKpis = document.getElementById("platDetailKpis");
    document.getElementById("platChartTitle").textContent = name + " follower growth";
    if (!series.length) { elKpis.innerHTML = errorCard(new Error("No history yet for " + name)); return; }
    var first = series[0], last = series[series.length - 1];
    var change = (last.followers != null && first.followers != null) ? last.followers - first.followers : last.change;
    elKpis.innerHTML = kpiHtml("Followers", last.followers != null ? last.followers.toLocaleString() : "—",
      change != null ? (change >= 0 ? "+" + change : change) + " tracked" : "", change > 0 ? "up" : change < 0 ? "down" : "flat") +
      kpiHtml("Data points logged", series.length) +
      kpiHtml("First logged", first.date ? fmtDate(first.date) : "—") +
      kpiHtml("Last refreshed", last.date ? fmtDate(last.date) : "—");

    var ctx = document.getElementById("platChart").getContext("2d");
    if (platChart) platChart.destroy();
    platChart = new Chart(ctx, {
      type: "line",
      data: { labels: series.map(function (r) { return r.date.toLocaleDateString("en-IE", { day: "numeric", month: "short" }); }),
        datasets: [{ label: "Followers", data: series.map(function (r) { return r.followers; }), borderColor: "#7C5CFC", backgroundColor: "rgba(124,92,252,0.12)", fill: true, tension: 0.3, pointRadius: series.length < 10 ? 3 : 0, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: "#ECEAF0" } }, x: { grid: { display: false } } } }
    });
  }

  function renderPlatformCards(byPlatform) {
    var grid = document.getElementById("platGrid");
    var colors = { Instagram: "#d6249f", Facebook: "#1877F2", LinkedIn: "#0A66C2", TikTok: "#111" };
    var html = "";
    ["Instagram", "Facebook", "LinkedIn", "TikTok"].forEach(function (name) {
      var series = byPlatform[name] || [];
      if (!series.length) { html += '<div class="plat-card" data-plat="' + name + '"><div class="plat-icon" style="background:' + colors[name] + '">' + escapeHtml(platInitials(name)) + '</div><div class="plat-name">' + name + '</div><div class="plat-sub">No data yet</div></div>'; return; }
      var first = series[0], last = series[series.length - 1];
      var change = (last.followers != null && first.followers != null) ? last.followers - first.followers : last.change;
      var deltaClass = change > 0 ? "up" : change < 0 ? "down" : "flat";
      html += '<div class="plat-card" data-plat="' + name + '"><div class="plat-icon" style="background:' + colors[name] + '">' + escapeHtml(platInitials(name)) + '</div>' +
        '<div class="plat-name">' + name + '</div><div class="plat-followers">' + (last.followers != null ? last.followers.toLocaleString() : "—") + '</div>' +
        '<div class="plat-delta ' + deltaClass + '">' + (change != null ? (change >= 0 ? "▲ +" + change : "▼ " + change) : "") + '</div>' +
        '<div class="plat-sub">Last refreshed ' + (last.date ? fmtDate(last.date) : "—") + '</div></div>';
    });
    grid.innerHTML = html;
    grid.querySelectorAll(".plat-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var key = card.dataset.plat;
        document.querySelectorAll("#platformsViewNav .subnav-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.plat === key); });
        switchPlatformView(key, byPlatform);
      });
    });
  }

  function switchPlatformView(key, byPlatform) {
    var allView = document.getElementById("platformsAllView");
    var detailView = document.getElementById("platformsDetailView");
    if (key === "all") { allView.style.display = ""; detailView.style.display = "none"; }
    else { allView.style.display = "none"; detailView.style.display = ""; renderPlatformDetail(key, byPlatform); }
  }

  // ---------- panel loaders ----------
  function loadOverview() {
    var elKpis = document.getElementById("overviewKpis"), elUpcoming = document.getElementById("overviewUpcoming"), elWip = document.getElementById("overviewWip");
    Promise.all([
      loadScheduled(60).catch(function () { return []; }),
      loadIdeas().catch(function () { return []; }),
      loadSnapshot().catch(function () { return {}; })
    ]).then(function (results) {
      var scheduled = results[0], ideas = results[1], byPlatform = results[2];
      var wip = ideas.filter(function (r) { return r.Status !== "Posted"; });
      var scheduledThisWeek = scheduled.filter(function (p) { return daysFromNow(p.date) >= 0 && daysFromNow(p.date) <= 7; }).length;
      var totalFollowers = 0, haveAny = false;
      Object.keys(byPlatform).forEach(function (k) {
        var series = byPlatform[k];
        if (series.length) { totalFollowers += series[series.length - 1].followers || 0; haveAny = true; }
      });
      elKpis.innerHTML = kpiHtml("Scheduled this week", scheduledThisWeek) + kpiHtml("In the works", wip.length) +
        kpiHtml("Followers (all platforms)", haveAny ? totalFollowers.toLocaleString() : "—") + kpiHtml("Scheduled (60d)", scheduled.length);
      document.getElementById("upcomingCount").textContent = scheduled.length ? scheduled.length + " queued" : "";
      renderScheduleList(elUpcoming, scheduled.filter(function (p) { return daysFromNow(p.date) >= 0 && daysFromNow(p.date) <= 7; }), 5);
      document.getElementById("wipCount").textContent = wip.length ? wip.length + " active" : "";
      if (!wip.length) { elWip.innerHTML = emptyState("✨", "Nothing in progress", "New ideas will appear here as soon as they're added to the board."); }
      else {
        var html = "";
        wip.slice(0, 5).forEach(function (r) {
          html += '<div class="item-row"><div class="item-body"><div class="item-title">' + escapeHtml(r.Idea || "Untitled") + ' <span class="pill ' + statusPillClass(r.Status) + '" style="margin-left:6px;">' + escapeHtml(r.Status || "") + '</span></div>' +
            '<div class="item-meta">' + escapeHtml((Array.isArray(r.Platform) ? r.Platform.join(", ") : "") || "") + (r["Content Type"] ? " · " + escapeHtml(r["Content Type"]) : "") + '</div></div></div>';
        });
        elWip.innerHTML = html;
      }
    }).catch(function (e) { elKpis.innerHTML = errorCard(e); elUpcoming.innerHTML = errorCard(e); elWip.innerHTML = errorCard(e); });
  }

  function loadSchedulePanel() {
    loadScheduled(60).then(function (posts) { state.currentView = state.currentView || "list"; renderCurrentScheduleView(posts); })
      .catch(function (e) { document.getElementById("scheduleContent").innerHTML = errorCard(e); });
  }
  function renderCurrentScheduleView(posts) {
    var el = document.getElementById("scheduleContent");
    var view = state.currentView || "list";
    if (view === "list") renderScheduleList(el, posts);
    else if (view === "calendar") renderCalendar(el, posts);
    else if (view === "grid") renderGridPreview(el, posts.slice(0, 30));
  }
  document.getElementById("scheduleViewNav").addEventListener("click", function (e) {
    var btn = e.target.closest(".subnav-btn"); if (!btn) return;
    document.querySelectorAll("#scheduleViewNav .subnav-btn").forEach(function (b) { b.classList.toggle("active", b === btn); });
    state.currentView = btn.dataset.view;
    renderCurrentScheduleView(state.scheduledCache || []);
  });

  function loadIdeasPanel() {
    loadIdeas().then(function (rows) {
      document.getElementById("ideasCount").textContent = rows.length ? rows.length + " items" : "";
      renderIdeasTable(document.getElementById("ideasContent"), rows);
    }).catch(function (e) { document.getElementById("ideasContent").innerHTML = errorCard(e); });
  }

  function loadPlatformsPanel() {
    loadSnapshot().then(function (byPlatform) { renderPlatformCards(byPlatform); })
      .catch(function (e) { document.getElementById("platGrid").innerHTML = errorCard(e); });
  }
  document.getElementById("platformsViewNav").addEventListener("click", function (e) {
    var btn = e.target.closest(".subnav-btn"); if (!btn) return;
    document.querySelectorAll("#platformsViewNav .subnav-btn").forEach(function (b) { b.classList.toggle("active", b === btn); });
    switchPlatformView(btn.dataset.plat, state.snapshotByPlatform || {});
  });

  function showTab(name) {
    document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.tab === name); });
    document.querySelectorAll(".panel").forEach(function (p) { p.classList.toggle("active", p.id === "panel-" + name); });
    try { localStorage.setItem("sm_dashboard_tab", name); } catch (e) {}
    if (!state.loaded[name]) {
      state.loaded[name] = true;
      if (name === "overview") loadOverview();
      else if (name === "schedule") loadSchedulePanel();
      else if (name === "ideas") loadIdeasPanel();
      else if (name === "platforms") loadPlatformsPanel();
    }
  }
  document.getElementById("tabNav").addEventListener("click", function (e) { var btn = e.target.closest(".tab-btn"); if (btn) showTab(btn.dataset.tab); });

  var initial = "overview";
  try { initial = localStorage.getItem("sm_dashboard_tab") || "overview"; } catch (e) {}
  showTab(initial);
})();
