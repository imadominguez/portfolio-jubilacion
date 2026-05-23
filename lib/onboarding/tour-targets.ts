export const PRIMER_USO_TOUR = "primerUso";

export const TOUR_STEP_WELCOME = 0;
export const TOUR_STEP_NAV_SNAPSHOTS = 1;
export const TOUR_STEP_NAV_GUIA = 2;
export const TOUR_STEP_GUIDE_SNAPSHOTS = 3;
export const TOUR_STEP_NAV_TRANSACCIONES = 4;
export const TOUR_STEP_GUIDE_TRANSACCIONES = 5;

export const SIDEBAR_TOUR_SELECTORS = new Set([
  "#tour-nav-snapshots",
  "#tour-nav-guia",
  "#tour-nav-transacciones",
]);

export function nudgeTourPosition() {
  window.dispatchEvent(new Event("resize"));
}

export function scrollSidebarTourTarget(selector: string) {
  window.scrollTo({ top: 0, behavior: "smooth" });

  window.setTimeout(() => {
    const element = document.querySelector(selector);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }

    window.setTimeout(nudgeTourPosition, 120);
    window.setTimeout(nudgeTourPosition, 480);
  }, 80);
}

export function scrollGuideTourTarget(targetId: string) {
  window.setTimeout(() => {
    document.getElementById(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    window.setTimeout(nudgeTourPosition, 120);
    window.setTimeout(nudgeTourPosition, 520);
  }, 80);
}
