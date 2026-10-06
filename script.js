// Резервный релиз
const FALLBACK_RELEASE = {
  tagName: "2.1.2",
  apkUrl: "https://github.com/Savvy08/MatchFeed/releases/download/2.1.2/MatchFeed-2.1.2.apk"
};

// Тема
function initTheme() {
  const root = document.documentElement;
  const toggleBtn = document.getElementById("theme-toggle");
  const storedTheme = localStorage.getItem("matchfeed-theme");

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
  }

  const initialTheme = storedTheme || getSystemTheme();
  applyTheme(initialTheme);

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
      if (!localStorage.getItem("matchfeed-theme")) {
        applyTheme(e.matches ? "light" : "dark");
      }
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const currentTheme = root.getAttribute("data-theme") || "dark";
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      localStorage.setItem("matchfeed-theme", nextTheme);
    });
  }
}

// 3D сцена
function init3DCarousel() {
  const wrap = document.getElementById("scene-3d-wrap");
  const stage = document.getElementById("scene-3d-stage");
  const phoneItems = [
    document.getElementById("phone-item-0"),
    document.getElementById("phone-item-1"),
    document.getElementById("phone-item-2")
  ];
  const tabBtns = document.querySelectorAll(".scene-tab");

  if (!wrap || !stage || phoneItems.some((item) => !item)) return;

  let activeIndex = 1;

  function updateSlots(centerIdx) {
    activeIndex = centerIdx;
    const leftIdx = (centerIdx + 2) % 3;
    const rightIdx = (centerIdx + 1) % 3;

    phoneItems.forEach((el) => {
      el.classList.remove("slot-left", "slot-center", "slot-right");
    });

    phoneItems[leftIdx].classList.add("slot-left");
    phoneItems[centerIdx].classList.add("slot-center");
    phoneItems[rightIdx].classList.add("slot-right");

    tabBtns.forEach((tab) => {
      const idx = parseInt(tab.getAttribute("data-index"), 10);
      if (idx === centerIdx) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });
  }

  updateSlots(activeIndex);

  tabBtns.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetIdx = parseInt(tab.getAttribute("data-index"), 10);
      if (!isNaN(targetIdx) && targetIdx !== activeIndex) {
        updateSlots(targetIdx);
      }
    });
  });

  // Свайпы и скролл
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isScrollAction = false;
  let suppressClickUntil = 0;

  wrap.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      isScrollAction = false;
    },
    { passive: true }
  );

  wrap.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;

      if (Math.abs(dy) > 8) {
        isScrollAction = true;
      }
    },
    { passive: true }
  );

  wrap.addEventListener(
    "touchend",
    (e) => {
      const touchDuration = Date.now() - touchStartTime;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;

      if (isScrollAction) {
        suppressClickUntil = Date.now() + 350;
        return;
      }

      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4 && touchDuration < 400) {
        suppressClickUntil = Date.now() + 350;
        if (dx < 0) {
          updateSlots((activeIndex + 1) % 3);
        } else {
          updateSlots((activeIndex + 2) % 3);
        }
      }
    },
    { passive: true }
  );

  // Клик по слайдам
  phoneItems.forEach((item) => {
    item.addEventListener("click", () => {
      if (Date.now() < suppressClickUntil) return;

      const clickedIndex = parseInt(item.getAttribute("data-index"), 10);
      if (!isNaN(clickedIndex) && clickedIndex !== activeIndex) {
        updateSlots(clickedIndex);
      }
    });
  });

  // 3D наклон
  if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
    let currentTiltX = 0;
    let currentTiltY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let isHovered = false;
    let animFrameId = null;

    function renderTilt() {
      currentTiltX += (targetTiltX - currentTiltX) * 0.1;
      currentTiltY += (targetTiltY - currentTiltY) * 0.1;

      stage.style.transform = `rotateX(${currentTiltX.toFixed(2)}deg) rotateY(${currentTiltY.toFixed(2)}deg)`;

      if (isHovered || Math.abs(currentTiltX) > 0.05 || Math.abs(currentTiltY) > 0.05) {
        animFrameId = requestAnimationFrame(renderTilt);
      } else {
        stage.style.transform = "";
        animFrameId = null;
      }
    }

    wrap.addEventListener("mousemove", (e) => {
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const normX = (x / rect.width - 0.5) * 2;
      const normY = (y / rect.height - 0.5) * 2;

      targetTiltY = normX * 7;
      targetTiltX = -normY * 5;

      if (!isHovered) {
        isHovered = true;
        if (!animFrameId) animFrameId = requestAnimationFrame(renderTilt);
      }
    });

    wrap.addEventListener("mouseleave", () => {
      isHovered = false;
      targetTiltX = 0;
      targetTiltY = 0;
      if (!animFrameId) animFrameId = requestAnimationFrame(renderTilt);
    });
  }
}

// Ссылки на APK
function updateDownloadLinks(apkUrl, versionTag) {
  const cleanTag = versionTag ? versionTag.replace(/^v/i, "") : "2.1.2";

  const btnHero = document.getElementById("btn-download-apk");
  const btnHeroMeta = document.getElementById("btn-download-meta");
  const btnBottom = document.getElementById("btn-download-bottom");

  if (btnHero) {
    btnHero.href = apkUrl;
    btnHero.setAttribute("download", `MatchFeed-${cleanTag}.apk`);
  }
  if (btnHeroMeta) {
    btnHeroMeta.textContent = `Версия ${cleanTag}`;
  }
  if (btnBottom) {
    btnBottom.href = apkUrl;
    btnBottom.setAttribute("download", `MatchFeed-${cleanTag}.apk`);
  }
}

// Релиз GitHub
async function fetchLatestRelease() {
  const apiUrl = "https://api.github.com/repos/Savvy08/MatchFeed/releases";

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json"
      }
    });

    if (!response.ok) {
      throw new Error(`Статус API: ${response.status}`);
    }

    const releases = await response.json();
    if (!Array.isArray(releases) || releases.length === 0) {
      throw new Error("Релизы не найдены");
    }

    const stableRelease = releases.find((r) => !r.prerelease && !r.draft);
    if (!stableRelease) {
      throw new Error("Стабильный релиз не найден");
    }

    const apkAsset = (stableRelease.assets || []).find((asset) =>
      asset.name && asset.name.toLowerCase().endsWith(".apk")
    );

    const downloadUrl = apkAsset
      ? apkAsset.browser_download_url
      : (stableRelease.html_url || FALLBACK_RELEASE.apkUrl);

    updateDownloadLinks(downloadUrl, stableRelease.tag_name || FALLBACK_RELEASE.tagName);
  } catch (error) {
    updateDownloadLinks(FALLBACK_RELEASE.apkUrl, FALLBACK_RELEASE.tagName);
  }
}

// Инициализация
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  init3DCarousel();
  fetchLatestRelease();
});
