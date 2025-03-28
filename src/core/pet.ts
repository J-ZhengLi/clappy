import { AnimatedSprite, Application, Assets, Container, Sprite, Texture, Text } from "pixi.js";
import { invokeCommand } from "./utils";
import { Point2D } from "./types";

enum DragStatus {
    Entered,
    Exited,
    Dragging,
}

export class Pet {
    private app: Application;
    private container?: Container;
    private isCursorEventsIgnored: boolean;
    private dragStatus: DragStatus;
    private dragOffset: Point2D;
    private isRunningClippy: boolean;
    private text?: Text;
    private dialogHideTimeout?: number;

    constructor() {
        this.app = new Application();
        // this option was initially set to true during setup in Rust side
        this.isCursorEventsIgnored = true;
        // indicates whether 'clappy' is already running 'clippy' in the background,
        // used to prevent spamming clicks.
        this.isRunningClippy = false;
        this.dragStatus = DragStatus.Exited;
        this.dragOffset = { x: 0.0, y: 0.0 };
    }

    playAnimation(anim: string) {
        console.log('playing: ', anim);
    }

    showMessageDialog(msg: string) {
        const dialogContainer = this.container?.getChildByLabel('dialog');
        const bubble = dialogContainer?.getChildByLabel('bubble') as AnimatedSprite;
        if (dialogContainer && bubble && this.text) {
            dialogContainer.visible = true;

            const text = this.text;
            text.visible = false;
            text.text = msg;
            text.y = -bubble.height * 0.8;
            text.x = -bubble.width * 0.7;

            bubble.gotoAndPlay(0);
            bubble.onComplete = () => {
                text.visible = true;
            };

            // hide the dialog bubble after timeout, overriding the existing timeout
            if (this.dialogHideTimeout) {
                window.clearTimeout(this.dialogHideTimeout);
            }
            this.dialogHideTimeout = setTimeout(() => {
                dialogContainer.visible = false;
            }, 10000);
        }
    }

    async setup() {
        await this.app.init({
            backgroundColor: 0x000000,
            backgroundAlpha: 0,
            resizeTo: window,
        });

        document.body.appendChild(this.app.canvas);
    }

    async preload() {
        // TODO: load multiple pet atlas from a json file
        const assets = [
            { alias: 'ferris', src: 'companions/ferris.png' },
            { alias: 'dialogBubble', src: 'dialog-bubble/bubble.json' },
        ]

        await Assets.load(assets);

        // create a container for pet and its dialog bubble
        const container = new Container();
        container.pivot.set(0.5);
        container.scale.set(0.4);

        this.setupPet(container);
        this.setupDialogBubble(container);
        this.container = container;
        this.app.stage.addChild(container);
    }

    update() {
        this.app.ticker.add(() => {
            this.toggleCursorEvents();
        })
    }

    toggleCursorEvents() {
        invokeCommand('get_cursor_pos').then((res) => {
            const cursorPos = res as Point2D;
            const bounds = this.container?.getChildByName("pet")?.getBounds();
            // if the cursor is within the pet's bound, enable cursor event, otherwise disable it.
            if (bounds && bounds.containsPoint(cursorPos.x, cursorPos.y)) {
                if (!this.isCursorEventsIgnored) {
                    // do nothing if cursor events was already enabled
                    return;
                }

                // NB: for some reason, `getCurrentWindow().setIgnoreCursorEvents` throws error
                invokeCommand('ignore_cursor_events', { ignore: false }).then(() => {
                    this.isCursorEventsIgnored = false;
                })
            } else if (!this.isCursorEventsIgnored) {
                invokeCommand('ignore_cursor_events', { ignore: true }).then(() => {
                    this.isCursorEventsIgnored = true;
                })
            }
        });
    }

    setupPet(container: Container) {
        let sprite = new Sprite(Texture.from('ferris'));
        sprite.label = "pet";
        sprite.anchor.set(0.5);

        // set the initial position of the whole container to the bottom-right
        container.x = this.app.screen.width - sprite.width;
        container.y = this.app.screen.height - sprite.height;

        // setup interaction events
        sprite.interactive = true;
        sprite.on('mousedown', (e) => {
            this.dragStatus = DragStatus.Entered;
            this.dragOffset.x = e.global.x - container.x;
            this.dragOffset.y = e.global.y - container.y;
        });
        sprite.on('mouseup', () => {
            // the pet was not dragged nor currently "working", trigger `click` action instead
            if (this.dragStatus !== DragStatus.Dragging && !this.isRunningClippy) {
                this.isRunningClippy = true;
                this.playAnimation('working');
                invokeCommand('execute_clippy').then(() => this.isRunningClippy = false);
            }
            this.dragStatus = DragStatus.Exited;
        });
        sprite.on('mousemove', (e) => {
            if (this.dragStatus === DragStatus.Exited) return;
            // update pet position.
            // subtract the cursor point offset, otherwise the pet will suddenly get teleported
            container.x = e.clientX - this.dragOffset.x;
            container.y = e.clientY - this.dragOffset.y;

            const bubble = container.getChildByLabel('bubble');
            if (bubble) {
                console.log(bubble.x);
            }

            this.dragStatus = DragStatus.Dragging;
        });

        container.addChild(sprite);
    }

    setupDialogBubble(container: Container) {
        // create a container for dialog bubble and textbox
        const dialogContainer = new Container();
        dialogContainer.label = 'dialog'

        // add an animated bubble to display text
        const animations = Assets.cache.get('dialogBubble').data.animations;
        const bubble = AnimatedSprite.fromFrames(animations['bubble']);
        bubble.anchor.set(1.2);
        bubble.label = "bubble";
        // set the animation speed to 5 fps
        bubble.animationSpeed = 1 / 5;
        bubble.loop = false;
        dialogContainer.addChild(bubble);

        // add text element to show messages
        const text = new Text({
            style: {
                breakWords: true,
                wordWrap: true,
                wordWrapWidth: bubble.width * 0.7,
                fill: 'black',
                fontFamily: 'Arial',
                fontSize: 45,
                align: 'center',
                padding: 5,
            },
        });
        text.label = 'text';
        text.anchor.set(0.5);
        this.text = text;
        dialogContainer.addChild(text);

        // hide the bubble, it should only be shown when there's a message to display
        dialogContainer.visible = false;
        container.addChild(dialogContainer);
    }
}
