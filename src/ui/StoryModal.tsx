import { useEffect } from 'react';
import { dismissStory, storyBeatDef } from '../game/story';
import { useGameState, useGameStore } from '../hooks/useGame';
import { useBattleOpen } from './battlePresence';
import { playNotify } from './sfx';
import { Modal } from './components';

/** Shows the oldest pending story beat; dismissing marks it seen. Beats wait
 *  while a battle is playing rather than cutting over it — see battlePresence. */
export function StoryModal() {
  const store = useGameStore();
  const state = useGameState();
  const battleOpen = useBattleOpen();
  const beatId = battleOpen ? undefined : (state.pendingStories[0] as string | undefined);

  // Read beat data early (before returns) so we can use it in hooks
  const beat = beatId ? storyBeatDef(beatId) : undefined;
  const isPrestige = beat?.type === 'prestige';

  // All hooks before any early return — React Rules of Hooks
  useEffect(() => {
    if (beatId && store.getState().settings.sfxEnabled) playNotify();
  }, [beatId, store]);

  useEffect(() => {
    if (!isPrestige || !beatId) return;
    // Use store.getState() to read latest state (effect captures stale closure)
    const ms = store.getState().settings.reducedMotion ? 6000 : 4000;
    const t = setTimeout(() => store.dispatch((s) => dismissStory(s, beatId)), ms);
    return () => clearTimeout(t);
  }, [isPrestige, beatId, store]);

  if (!beatId || !beat) return null;

  return (
    <Modal
      title={beat.title}
      onClose={() => store.dispatch((s) => dismissStory(s, beatId))}
      dismissable={false}
      className={isPrestige ? 'prestige-beat' : ''}
      footer={
        <button
          className="story-continue"
          onClick={() => store.dispatch((s) => dismissStory(s, beatId))}
        >
          Continue
        </button>
      }
    >
      <p className="story-text">{beat.text}</p>
    </Modal>
  );
}
