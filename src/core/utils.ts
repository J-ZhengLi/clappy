import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";

export async function invokeCommand(command: string, args = {}) {
    try {
        return await invoke(command, args);
    } catch (error: any) {
        await message(error || 'Unknown error', {
            title: 'Error',
            kind: 'error',
        });
        throw error;
    }
}

export function resizeSpriteByWidth(sprite: any, targetWidth: number) {
    const scale = targetWidth / sprite.width;
    sprite.width = targetWidth;
    sprite.height *= scale;
}
