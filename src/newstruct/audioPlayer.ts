import {
    AudioPlayer as AP,
    AudioPlayerStatus,
    AudioResource,
    createAudioPlayer,
    createAudioResource,
    entersState,
    StreamType,
    VoiceConnectionDisconnectReason,
    VoiceConnectionStatus,
} from "@discordjs/voice";
import {
    AutoPlay,
    LoopMode,
    PlatformType,
    PlayerEvents,
    PluginName,
} from "./../typings/enums";
import { AudioPlayerMode, AudioPLayerOptions } from "./../typings/interfaces";
import {
    generateInfo,
    generateScInfo,
    requestInfo,
    requestStream,
} from "../newutils/request";
import {
    LocalFileTrackInfo,
    Plugin,
    SoundCloudTrackInfo,
    SpotifyTrackInfo,
    Track,
    UrlTrackInfo,
    YoutubeTrackInfo,
} from "../typings/types";
import { GuildMember } from "discord.js";
import { setTimeout } from "timers/promises";
import { formatedPlatforms, QueueFormatRegex } from "../newutils/constants";
import { search } from "../newutils/search";
import Video from "youtubei.js/dist/src/parser/classes/Video";
import {
    shuffle,
    YoutubeRelated,
    ytRelatedHTMLParser,
} from "../newutils/helpers";
import { Filter } from "./filter";
import { PassThrough, Readable } from "stream";
import { ReadableStream } from "stream/web";
import { FFmpeg } from "prism-media";
import { Cacher } from "./cacher";
import { fetch } from "undici";
export class AudioPlayer {
    options: AudioPLayerOptions;
    #modes: AudioPlayerMode;
    queue: Track<keyof typeof PlatformType>[];
    player: AP;
    constructor(options: AudioPLayerOptions) {
        this.options = options;
        this.#modes = this.defaultMode();
        this.queue = [];
        this.player = createAudioPlayer();
        this._configPlayer();
        this.__configConnection();
    }
    defaultMode(): AudioPlayerMode {
        return {
            loop: LoopMode.None,
            filterFromStart: false,
            shuffled: false,
            filtering: false,
            paused: false,
            volume: 100,
            currentTrack: 0,
            autoPlay: AutoPlay.None,
            filters: [],
            ytMix: {
                enabled: false,
                lastUrl: null,
            },
        };
    }

    async play() {
        let resource: AudioResource;
        const current = this.queue[this.#modes.currentTrack];
        let stream: Readable = await requestStream(
            current,
            current.formatedPlatforms,
            this.options.manager,
        );
        let s: Readable | FFmpeg;
        if (this.options.manager.plugins.has(PluginName.Cacher)) {
            const Cacher = <Plugin<PluginName.Cacher>>(
                this.options.manager.plugins.get(PluginName.Cacher)
            );
            await Cacher.write(current, stream);
            if (Cacher.type === "disk") stream = Cacher.get(current.id);
        }
        if (
            this.options.manager.plugins.has(PluginName.Filter) &&
            this.#modes.filters.length
        ) {
            const f = <Filter>(
                this.options.manager.plugins.get(PluginName.Filter)
            );
            const ffmpeg = f.createFFmpeg("-af", this.#modes.filters.join(","));
            s = stream.pipe(ffmpeg);
            resource = createAudioResource(s, {
                inlineVolume: true,
                inputType: StreamType.Raw,
            });
        } else {
            s = stream;
            resource = createAudioResource(s, {
                inlineVolume: true,
                inputType: StreamType.Arbitrary,
            });
        }
        this.options.manager.emit(PlayerEvents.TRACK_START, current, this);
        this.player.play(resource);
        if (this.#modes.ytMix) {
            if (
                this.queue[this.#modes.currentTrack].id ===
                this.#modes.ytMix.lastUrl
            ) {
                const tracks = <Video[]>(
                    await this.options.manager.search(
                        PlatformType.Youtube,
                        this.queue[this.#modes.currentTrack].id,
                        3,
                    )
                );
                await this.add(
                    tracks.map(
                        (x) => `https://www.youtube.com/watch?v=${x.id}`,
                    ),
                    PlatformType.Youtube,
                    this.queue[this.#modes.currentTrack].requester,
                );
            }
        }
    }
    async _loopQueue() {
        if (this.#modes.currentTrack >= this.queue.length - 1) {
            this.#modes.currentTrack = 0;
        } else {
            this.#modes.currentTrack++;
        }
        await this.play();
    }
    async _playNext() {
        const Cacher = <Plugin<PluginName.Cacher>>(
            this.options.manager.plugins.get(PluginName.Cacher)
        );
        if (this.options.type === "default") {
            if (this.#modes.currentTrack >= 1) {
                const track = this.queue.shift();
                if (this.options.manager.plugins.has(PluginName.Cacher)) {
                    Cacher.delete(track.id);
                }
            } else {
                this.#modes.currentTrack += 1;
                Cacher.delete(this.queue[this.currentPosition() - 1].id);
            }
        } else if (this.options.type === "fonly") {
            const track = this.queue.shift();
            if (this.options.manager.plugins.has(PluginName.Cacher)) {
                const Cacher = <Plugin<PluginName.Cacher>>(
                    this.options.manager.plugins.get(PluginName.Cacher)
                );
                Cacher.delete(track.id);
            }
        } else {
            this.#modes.currentTrack += 1;
        }
        await this.play();
    }
    _destroy() {
        this.#modes = this.defaultMode();
        this.queue = [];
        this.player.stop(true);
        if (this.options.manager.plugins.has(PluginName.Cacher)) {
            const cacher = <Plugin<PluginName.Cacher>>(
                this.options.manager.plugins.get(PluginName.Cacher)
            );
            cacher.clear();
        }
    }
    _configPlayer(): void {
        this.player.on("stateChange", async (os, ns) => {
            if (
                os.status !== AudioPlayerStatus.Idle &&
                ns.status === AudioPlayerStatus.Idle
            ) {
                if (this.#modes.paused) {
                } else if (
                    this.#modes.loop === LoopMode.Track &&
                    this.queue[this.#modes.currentTrack]
                ) {
                    if (this.#modes.seeked) {
                        this.#modes.seeked = false;
                        return;
                    }
                    if (this.#modes.filtering) {
                        this.#modes.filtering = false;
                        return;
                    } else {
                        this.options.manager.emit(
                            PlayerEvents.TRACK_END,
                            this.queue[this.#modes.currentTrack],
                            this,
                        );
                        await this.play();
                    }
                } else if (
                    this.#modes.loop === LoopMode.Queue &&
                    this.queue.length
                ) {
                    if (this.#modes.seeked) {
                        this.#modes.seeked = false;
                        return;
                    }
                    if (this.#modes.filtering) {
                        this.#modes.filtering = false;
                        return;
                    } else {
                        this.options.manager.emit(
                            PlayerEvents.TRACK_END,
                            this.queue[this.#modes.currentTrack],
                            this,
                        );
                        await this._loopQueue();
                    }
                } else if (
                    this.#modes.autoPlay != "none" &&
                    this.queue.length === 1
                ) {
                    if (this.#modes.seeked) {
                        this.#modes.seeked = false;
                        return;
                    }
                    if (this.#modes.filtering) {
                        this.#modes.filtering = false;
                        return;
                    } else {
                        this.options.manager.emit(
                            PlayerEvents.TRACK_END,
                            this.queue[this.#modes.currentTrack],
                            this,
                        );
                        await this.autoPlayNext();
                    }
                } else if (
                    this.queue.length > 1 &&
                    this.#modes.currentTrack < this.queue.length - 1
                ) {
                    if (this.#modes.seeked) {
                        this.#modes.seeked = false;
                        return;
                    }
                    if (this.#modes.filtering) {
                        this.#modes.filtering = false;
                        return;
                    } else {
                        this.options.manager.emit(
                            PlayerEvents.TRACK_END,
                            this.queue[this.#modes.currentTrack],
                            this,
                        );
                        await this._playNext();
                    }
                } else {
                    if (this.#modes.seeked) {
                        this.#modes.seeked = false;
                        return;
                    }
                    if (this.#modes.filtering) {
                        this.#modes.filtering = false;
                        return;
                    } else {
                        this.options.manager.emit(
                            PlayerEvents.TRACK_END,
                            this.queue[this.#modes.currentTrack],
                            this,
                        );
                        this.options.manager.emit(PlayerEvents.QUEUE_END, this);
                        this._destroy();
                    }
                }
            }
            if (
                os.status === AudioPlayerStatus.Playing &&
                ns.status !== AudioPlayerStatus.Playing &&
                ns.status !== AudioPlayerStatus.Idle &&
                ns.status !== AudioPlayerStatus.Paused
            ) {
                if (this.#modes.seeked) {
                    this.#modes.seeked = false;
                    return;
                }
                if (this.#modes.filtering) {
                    this.#modes.filtering = false;
                    return;
                } else {
                    this.options.manager.emit(
                        PlayerEvents.TRACK_END,
                        this.queue[this.#modes.currentTrack],
                        this,
                    );
                }
            }
        });
        this.player.on("error", async (error: any) => {
            this.options.manager.emit(PlayerEvents.AUDIO_ERROR, error, this);
        });

        if (this.options.manager.configs?.devOptions?.debug) {
            this.player.on("debug", (msg) =>
                this.options.manager.configs?.devOptions?.debug
                    ? console.log(msg)
                    : undefined,
            );
        }

        this.options.connection.subscribe(this.player);
    }
    async add(track: string[], type: PlatformType, member: GuildMember) {
        for (let i = 0; i < track.length; i++) {
            if (type === PlatformType.Youtube) {
                const id = track[i].split("?v=")[1].split("&")[0];
                if (
                    track[i].includes("&list=") &&
                    track[i].includes("&index=") &&
                    track.includes("watch?v=") &&
                    !this.#modes.ytMix.enabled
                ) {
                    this.#modes.ytMix.enabled = true;
                    this.#modes.ytMix.lastUrl = track[track.length - 1];
                }
                const info = await requestInfo(
                    id,
                    "Youtube",
                    this.options.manager,
                );
                if (!info) continue;
                this.queue.push({
                    ...(<YoutubeTrackInfo>info),
                    requester: member,
                    position: this.queue.length,
                });
                if (this.queue.length === 1) {
                    await this.play();
                }
            } else if (type === PlatformType.SoundCloud) {
                const info = await requestInfo(
                    track[i],
                    formatedPlatforms[PlatformType.SoundCloud],
                    this.options.manager,
                );

                if (!info) continue;
                for (let i = 0; i < (<SoundCloudTrackInfo[]>info).length; i++) {
                    this.queue.push({
                        ...(<SoundCloudTrackInfo>info[i]),
                        requester: member,
                        position: this.queue.length,
                    });
                    if (this.queue.length === 1) {
                        await this.play();
                    }
                }
            } else if (type === PlatformType.LocalFile) {
                const info = await requestInfo(
                    track[i],
                    "LocalFile",
                    this.options.manager,
                );
                if (!info) continue;
                this.queue.push({
                    ...(<LocalFileTrackInfo>info),
                    requester: member,
                    position: this.queue.length,
                });
                if (this.queue.length === 1) {
                    await this.play();
                }
            } else if (type === PlatformType.Spotify) {
                const info = <SpotifyTrackInfo[]>(
                    (<unknown>(
                        await requestInfo(
                            track[i],
                            "Spotify",
                            this.options.manager,
                        )
                    ))
                );
                if (!info) continue;
                for (let i = 0; i < info.length; i++) {
                    this.queue.push({
                        ...info[i],
                        requester: member,
                        position: this.queue.length,
                    });
                    if (this.queue.length === 1) {
                        await this.play();
                    }
                }
            } else if (type === PlatformType.Url) {
                const info = await requestInfo(
                    track[i],
                    formatedPlatforms[PlatformType.Url],
                    this.options.manager,
                );
                this.queue.push({
                    ...(<UrlTrackInfo>info),
                    requester: member,
                    position: this.queue.length,
                });
                if (this.queue.length === 1) {
                    await this.play();
                }
            }

            if (this.options.manager.configs.requestOptions?.offsetTimeout) {
                await setTimeout(
                    this.options.manager.configs.requestOptions?.offsetTimeout,
                );
            }
        }
    }
    skip() {
        return this.player.stop();
    }
    skipTo ( position: number )
    {
        if ( position > this.queue.length ) return;
        this.#modes.currentTrack = position - 1;
        if ( this.options.type === 'default' )
        {
            for ( let i = 0; i < position - 1; i++ )
            {
                if ( this.loop === LoopMode.Queue )
                {
                    this.queue.push( this.queue.shift() );
                } else
                {
                    this.queue.shift();
                }
            }
        } else if ( this.options.type === 'bidirect' )
        {
            
        } else if ( this.options.type === 'fonly' )
        {
            for (let i = 0; i < position ; i++) {
                if (this.loop === LoopMode.Queue) {
                    this.queue.push(this.queue.shift());
                } else {
                    this.queue.shift();
                }
            }
        }
        this.skip();
    }
    pause() {
        return (this.#modes.paused = this.player.pause());
    }
    resume() {
        this.#modes.paused = false;
        return this.player.unpause();
    }
    set volume(volume: number) {
        this.#modes.volume = volume;
        //@ts-ignore
        this.player.state.resource.volume.setVolume(volume / 100);
    }
    get volume() {
        return this.#modes.volume;
    }
    set loop(loop: LoopMode) {
        this.#modes.loop = loop;
    }
    get loop() {
        return this.#modes.loop;
    }
    set autoPlay(autoPlay: AutoPlay) {
        this.#modes.autoPlay = autoPlay;
    }
    get autoPlay() {
        return this.#modes.autoPlay;
    }
    shuffle() {
        this.queue = shuffle(this.queue);
        this.#modes.shuffled = true;
    }
    unshuffle() {
        this.queue = this.queue.sort((a, b) => a.position - b.position);
        this.#modes.shuffled = false;
    }
    isShuffled() {
        return this.#modes.shuffled;
    }
    isPaused() {
        return this.#modes.paused;
    }
    isLoopEnabled() {
        return this.#modes.loop !== LoopMode.None;
    }
    isAutoPlayEnabled() {
        return this.#modes.autoPlay !== AutoPlay.None;
    }
    currentPosition() {
        return this.#modes.currentTrack;
    }
    getTrackCurrentDuration() {
        //@ts-ignore
        return <number>this.player.state.resource?.playbackDuration ?? 0;
    }
    get currentTrack() {
        return this.queue[this.#modes.currentTrack];
    }
    get previousTrack() {
        return this.queue[this.#modes.currentTrack - 1];
    }
    updateFilters(filterArr: string[]) {
        this.#modes.filters.push(...filterArr);
    }
    async playPrevious ()
    {
        if ( this.#modes.currentTrack <= 0 ) return;
        this.#modes.currentTrack--;
        await this.play();
    }
    setFilters(filterArr: string[]) {
        this.#modes.filters = filterArr;
    }
    removeFilters() {
        this.#modes.filters = [];
    }
    get filters() {
        return [...this.#modes.filters];
    }
    get seek() {
        return this.#modes.seeked;
    }
    seeked(seek: boolean) {
        this.#modes.seeked = seek;
    }
    setFiltering(type: boolean) {
        this.#modes.filtering = type;
    }
    async autoPlayNext() {
        if (
            this.autoPlay === AutoPlay.Youtube ||
            this.autoPlay === AutoPlay.Spotify
        ) {
            const yt = await this.options.manager.platforms.youtube;
            const data = ytRelatedHTMLParser(
                await (
                    await fetch(
                        `https://youtube.com/watch?v=${this.currentTrack.id}`,
                    )
                ).text(),
            );
            const ids = YoutubeRelated(data);
            for (const id of ids) {
                const info = await requestInfo(
                    id,
                    this.autoPlay === "youtube" ? "Youtube" : "Spotify",
                    this.options.manager,
                );
                if (!info) {
                    continue;
                }
                this.queue.push({
                    ...(<YoutubeTrackInfo | SpotifyTrackInfo>info),
                    requester: this.currentTrack.requester,
                    position: this.queue.length,
                });
            }
        } else if (this.autoPlay === AutoPlay.SoundCloud) {
            const sc = this.options.manager.platforms.soundcloud;
            //@ts-ignore
            const { collection: data } = await sc.related(
                //@ts-ignore
                <number>this.currentTrack.scid,
                10,
            );
            for (const track of data) {
                const info = generateScInfo(track);
                if (!info) continue;
                this.queue.push({
                    ...(<SoundCloudTrackInfo>info),
                    requester: this.currentTrack.requester,
                    position: this.queue.length,
                });
            }
        } else if (this.autoPlay === AutoPlay.Relative) {
            if (
                this.currentTrack.formatedPlatforms.toLowerCase() ===
                    AutoPlay.Youtube ||
                this.currentTrack.formatedPlatforms.toLowerCase() ===
                    AutoPlay.Spotify
            ) {
                const yt = await this.options.manager.platforms.youtube;
                const data = ytRelatedHTMLParser(
                    await (
                        await fetch(
                            `https://youtube.com/watch?v=${this.currentTrack.id}`,
                        )
                    ).text(),
                );
                const ids = YoutubeRelated(data);
                for (const id of ids) {
                    const info = await requestInfo(
                        id,
                        formatedPlatforms[this.autoPlay],
                        this.options.manager,
                    );
                    if (!info) continue;
                    this.queue.push({
                        ...(<YoutubeTrackInfo | SpotifyTrackInfo>info),
                        requester: this.currentTrack.requester,
                        position: this.queue.length,
                    });
                }
            } else if (
                this.currentTrack.formatedPlatforms.toLowerCase() ===
                AutoPlay.SoundCloud
            ) {
                const sc = this.options.manager.platforms.soundcloud;
                //@ts-ignore
                const { collection: data } = await sc.related(
                    //@ts-ignore
                    <number>this.currentTrack.scid,
                    10,
                );
                for (const track of data) {
                    const info = generateScInfo(track);
                    if (!info) continue;
                    this.queue.push({
                        ...(<SoundCloudTrackInfo>info),
                        requester: this.currentTrack.requester,
                        position: this.queue.length,
                    });
                }
            }
        }

        await this._playNext();
    }
    __configConnection() {
        this.options.connection.on(
            "stateChange",
            async (
                _: any,
                newState: { status: any; reason: any; closeCode: number },
            ) => {
                if (newState.status === VoiceConnectionStatus.Disconnected) {
                    if (
                        newState.reason ===
                            VoiceConnectionDisconnectReason.WebSocketClose &&
                        newState.closeCode === 4014
                    ) {
                        try {
                            await entersState(
                                this.options.connection,
                                VoiceConnectionStatus.Connecting,
                                5_000,
                            );
                            // Probably moved voice channel
                        } catch {
                            this.options.connection.destroy();
                            this._destroy();
                            // Probably removed from voice channel
                        }
                    } else if (this.options.connection.rejoinAttempts < 5) {
                        /**
                         * The disconnect in this case is recoverable, and we also have <5 repeated attempts so we will reconnect.
                         */
                        await setTimeout(
                            (this.options.connection.rejoinAttempts + 1) *
                                5_000,
                        );
                        this.options.connection.rejoin();
                    } else {
                        /**
                         * The disconnect in this case may be recoverable, but we have no more remaining attempts - destroy.
                         */
                        this.options.connection.destroy();
                    }
                } else if (
                    newState.status === VoiceConnectionStatus.Destroyed
                ) {
                    /**
                     * Once destroyed, stop the subscription.
                     */
                    this._destroy();
                    this.player.stop(true);
                } else if (
                    newState.status === VoiceConnectionStatus.Connecting ||
                    newState.status === VoiceConnectionStatus.Signalling
                ) {
                    /**
                     * In the Signalling or Connecting states, we set a 20 second time limit for the connection to become ready
                     * before destroying the voice connection. This stops the voice connection permanently existing in one of these
                     * states.
                     */

                    try {
                        await entersState(
                            this.options.connection,
                            VoiceConnectionStatus.Ready,
                            20_000,
                        );
                    } catch {
                        if (
                            this.options.connection.state.status !==
                            VoiceConnectionStatus.Destroyed
                        )
                            this.options.connection.destroy();
                    }
                }
            },
        );
    }
    getQueue(
        page = 1,
        limit = 10,
        format = "{number}) {title} | {requester.user.name}",
    ) {
        const start = (page - 1) * limit;
        const end = page * limit;
        const tracks = this.queue.slice(start, end);
        const props = format.match(QueueFormatRegex);
        if (!props) return [];
        const queue = tracks.map((track, index) => {
            let formatted = format;
            props.forEach((prop) => {
                const propValue = prop.replace("{", "").replace("}", "");
                const value =
                    propValue === "position"
                        ? start + index
                        : eval(`track?.${propValue}`);
                formatted = formatted.replaceAll(prop, value);
            });
            return formatted;
        });
        return queue;
    }
    getPing ( type: 'ws' | 'udp' = "ws" )
    {
        return this.options.connection.ping[ type ];
    }
}