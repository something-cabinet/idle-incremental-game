import { useEffect } from 'react';
import { dismissStory, storyBeatDef } from '../game/story';
import { useGameState, useGameStore } from '../hooks/useGame';
import { useBattleOpen } from './battlePresence';
import { playNotify } from './sfx';

/** Shows the oldest pending story beat; dismissing marks it seen. Beats wait
 *  while a battle is playing rather than cutting over it — see battlePresence. */
export function StoryModal() {
  const store = useGameStore();
  const state = useGameState();
  const battleOpen = useBattleOpen();
  const beatId = battleOpen ? undefined : (state.pendingStories[0] as string | undefined);
  useEffect(() => {
    if (beatId && store.getState().settings.sfxEnabled) playNotify();
  }, [beatId, store]);
  if (!beatId) return null;
  const beat = storyBeatDef(beatId);
  if (!beat) return null;

  return (
    <div className="story-overlay">
      <div className="story-modal">
        <h2 className="story-title">{beat.title}</h2>
        <p className="story-text">{beat.text}</p>
        <button
          className="story-continue"
          onClick={() => store.dispatch((s) => dismissStory(s, beatId))}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
