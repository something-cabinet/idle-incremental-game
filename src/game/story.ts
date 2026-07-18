import {
  DEMON_KING_ID,
  GUILD_FOUNDING_COST,
  HOMETOWN_DEADLINE_DAY,
  STORY_BEATS,
} from './config';
import { currentDay } from './logic';
import { computeModifiers } from './perks';
import type { GameState, StoryBeatDef } from './types';

/** Story beats and act transitions. Beats fire once, queued for the UI. */

export function storyBeatDef(id: string): StoryBeatDef | undefined {
  return STORY_BEATS.find((b) => b.id === id);
}

function fired(state: GameState, id: string): boolean {
  return !!state.storyFlags[id] || state.pendingStories.includes(id);
}

function queue(state: GameState, id: string): GameState {
  if (fired(state, id)) return state;
  return { ...state, pendingStories: [...state.pendingStories, id] };
}

export function dismissStory(state: GameState, id: string): GameState {
  return {
    ...state,
    pendingStories: state.pendingStories.filter((p) => p !== id),
    storyFlags: { ...state.storyFlags, [id]: true },
  };
}

// ---------------------------------------------------------------------------
// Player-driven act transition: founding the guild (Act 1 → 2)
// ---------------------------------------------------------------------------

export function guildFoundingCost(state: GameState): number {
  return Math.ceil(GUILD_FOUNDING_COST * computeModifiers(state).costMult);
}

export function canFoundGuild(state: GameState): boolean {
  return state.act === 1 && state.gold >= guildFoundingCost(state);
}

export function foundGuild(state: GameState): GameState {
  if (!canFoundGuild(state)) return state;
  return queue(
    { ...state, act: 2, gold: state.gold - guildFoundingCost(state) },
    'a2-guild-founded',
  );
}

// ---------------------------------------------------------------------------
// Automatic triggers, evaluated every tick
// ---------------------------------------------------------------------------

export function checkStoryTriggers(state: GameState): GameState {
  let s = state;

  if (s.act === 1 && s.totalGoldEarned >= GUILD_FOUNDING_COST) {
    s = queue(s, 'a1-standing');
  }

  if (s.act >= 2 && s.adventurers.length >= 1) {
    s = queue(s, 'a2-first-adventurer');
  }

  // Clearing the last zone reveals the razed hometown → Act 3
  if (s.act === 2 && s.locationsCleared['frontier-pass']) {
    s = queue({ ...s, act: 3 }, 'a3-discovery');
  }

  if (s.bossesDefeated[DEMON_KING_ID]) {
    s = queue(s, 'a3-king-dead');

    // The ending: kill the king before the deadline in a later timeline
    if (
      !s.hometownSaved &&
      s.prestigeCount >= 1 &&
      currentDay(s) <= HOMETOWN_DEADLINE_DAY
    ) {
      s = queue({ ...s, hometownSaved: true }, 'ending-hometown-saved');
    }
  }

  return s;
}
