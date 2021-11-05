import voice, { VoiceConnection } from '@discordjs/voice';
import { TextChannel, VoiceChannel } from 'discord.js';
import { CacheType } from './constants';

export interface CacheOptions {
    enabled: boolean;
    cacheType: CacheType;
    limit?: number;
    directory?: string;
}

export interface SoundcloudOptions {
    clientId: string;
}

export interface ManagerConfig {
    cache?: CacheOptions;
    soundcloud?: SoundcloudOptions;
}

export interface voiceState {
    text: TextChannel;
    channel: VoiceChannel;
    connection: VoiceConnection;
}

export interface ManagerEvents extends PlayerEvents {
    
}

export interface PlayerEvents {
    trackStart(): any,
    trackEnd(): any,
    queueEnd(): any,
    error(): any
}