import { listen } from "@tauri-apps/api/event";
import { Pet } from "./core/pet";
import { PetAction } from "./core/types";

// disable context menu on right click
document.addEventListener('contextmenu', event => event.preventDefault());

const pet = new Pet();

listen('pet-action', (res) => {
    const payload = res.payload as PetAction;

    pet.playAnimation(payload.animation);
    if (payload.message) {
        pet.showMessageDialog(payload.message);
    }
});

// game lifetime
(async () => {
    await pet.setup();
    await pet.preload();
    pet.update();
})();
