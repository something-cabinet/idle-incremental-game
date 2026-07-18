import { dismissStory, storyBeatDef } from '../game/story';
import { useGameState, useGameStore } from '../hooks/useGame';

/** Shows the oldest pending story beat; dismissing marks it seen. */
export function StoryModal() {
  const store = useGameStore();
  const state = useGameState();
  const beatId = state.pendingStories[0];
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
