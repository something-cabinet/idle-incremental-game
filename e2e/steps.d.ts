/// <reference types='codeceptjs' />

type GamePage = import('./pages/GamePage');

declare namespace CodeceptJS {
  interface SupportObject {
    I: I;
    current: any;
    GamePage: GamePage;
  }
  interface Methods extends Playwright {}
  interface I extends WithTranslation<Methods> {}
  namespace Translation {
    interface Actions {}
  }
}
