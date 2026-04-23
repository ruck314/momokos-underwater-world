/* i18n – English / Japanese translations */
(function () {
  'use strict';

  var strings = {
    en: {
      /* ---- Title screen ---- */
      title: "Momoko's Under Water World",
      titleSubtitle: '~ An Underwater Adventure ~',
      play: 'Play',
      howToPlay: 'How to Play',
      instructions: 'Swim: Arrow Keys / D-Pad\nShoot Bubbles: Space / Bubble Button\nDefeat enemies and save the ocean!',
      language: 'Language',
      langLabel: 'EN',
      rotateHint: 'Please rotate your device to landscape mode!',
      bubbleBtn: 'BUBBLE',
      soundOn: 'Sound: ON',
      soundOff: 'Sound: OFF',

      /* ---- Intro / backstory ---- */
      introTitle: "Momoko's Tale",
      introText: "Deep beneath the waves lies Momoko's beloved ocean home.\nShe is the sea's Peach Princess – small but brave.\n\nOne day, the cruel mermaid Moni cast a dark spell.\nThe coral grew cold. The fish fled in fear.\nMomoko's friends became trapped in shadow.\n\nWith only her rainbow bubble gun and a brave heart,\nshe must dive deep and free her underwater world.\n\nAre you ready to help her?",
      continueBtn: 'Continue',

      /* ---- HUD / gameplay ---- */
      paused: 'Paused',
      resume: 'Resume',
      quit: 'Quit',
      hearts: 'Hearts',
      bossHP: 'MONI',

      /* ---- Game over / victory ---- */
      gameOver: 'Game Over',
      tryAgain: 'Try Again',
      victory: 'Victory!',
      savedOcean: 'You saved the ocean!',
      playAgain: 'Play Again',
      thanks: 'Thank you for playing!',

      /* ---- Beach cutscene ---- */
      beachTitle: 'The Beach!',
      beachTitleAlt1: 'Sunshine Break!',
      beachTitleAlt2: 'Hello, Surface!',
      beachTitleAlt3: 'Beach Day!',
      beachText: 'Everyone is having fun on the beach!\nBetter dive back in – the ocean needs you!',
      beachTextAlt1: 'A breath of fresh sea air!\nMoni is still waiting below…',
      beachTextAlt2: 'Wolfe is wagging his tail!\nDon\'t forget – Moni won\'t wait forever!',
      beachTextAlt3: 'The waves are calling you back…\nReady to dive again?',
      back: 'Dive Back In',

      /* ---- Customization ---- */
      customize: 'Customize Momoko',
      presets: 'Quick Styles',
      hairColor: 'Hair',
      suitColor: 'Suit',
      skinTone: 'Skin',
      startGame: 'Start!',
      presetOcean: 'Ocean Princess',
      presetExplorer: 'Deep Sea Explorer',
      presetRainbow: 'Rainbow Diver',
      presetCoral: 'Coral Queen',
      presetNight: 'Night Swimmer',
      /* Tab labels (match daughter's sketch) */
      tabHair: 'Hair',
      tabDress: 'Dress',
      tabSwim: 'Swim Suit',
      tabShoes: 'Shoes',
      tabCrab: 'Beach Crab',
      tabFood: 'Food',
      /* Variant names */
      varTwinTails: 'Twin-Tails',
      varLongBraids: 'Long Braids',
      varBuns: 'Twin Buns',
      varFrillyDress: 'Frilly',
      varSailorDress: 'Sailor',
      varStarDress: 'Star',
      varSailorSwimsuit: 'Sailor',
      varOnePiece: 'One-Piece',
      varFrillyBikini: 'Bikini',
      varMaryJane: 'Mary-Jane',
      varSneaker: 'Sneaker',
      varFlipper: 'Flipper',
      varNone: 'None',
      varCrabRed: 'Red',
      varCrabBlue: 'Blue',
      varCrabGold: 'Gold',
      varIceCream: 'Ice Cream',
      varOnigiri: 'Onigiri',
      varDonut: 'Donut',
      varCrepe: 'Crepe',
      varTaiyaki: 'Taiyaki',
      varParfait: 'Parfait',
      varMacaron: 'Macaron',
      varStrawberry: 'Strawberry',

      /* ---- NPC dialogue ---- */
      oliverGreet: 'Hey Momoko! Want to hear a joke?',
      kittyGreet: "Hi! I'm Kitty Corn! Be careful – the evil mermaid Moni is up ahead!",
      kittyHint: 'Shoot her with your rainbow bubbles! You can do it!',
      bobGreet: "Ahoy! I'm Bob the ocean expert! Did you know…",
      crabName: 'Crab',

      /* ---- Oliver's poop jokes (20) ---- */
      joke1: 'Why did the toilet paper roll down the hill?\nTo get to the bottom!',
      joke2: "What's a pirate's favorite bathroom?\nThe POOP deck!",
      joke3: "Why don't skeletons ever poop?\nThey have no guts!",
      joke4: 'What did one toilet say to the other?\n"You look a little flushed!"',
      joke5: 'Why did the poop cross the road?\nBecause it was on a roll!',
      joke6: 'What do you call a dinosaur that farts?\nA blast-o-saurus!',
      joke7: "What's brown and sticky?\nA stick!",
      joke8: 'How do fish go to the bathroom?\nThey just let it flow!',
      joke9: 'Why do farts smell?\nSo deaf noses can enjoy them too!',
      joke10: "What's invisible and smells like bananas?\nMonkey burps!",
      joke11: "What do you call a whale's fart?\nA bubble-bottom blast!",
      joke12: 'Why did the banana go to the bathroom?\nIt really had to split!',
      joke13: 'Why did the kid bring toilet paper to the party?\nHe was a party pooper!',
      joke14: "What's brown and loud?\nA tuba full of chocolate pudding!",
      joke15: 'Why did the fly land on the poo?\nIt wanted a stinky snack!',
      joke16: 'What do you call a smelly fairy?\nStinker Bell!',
      joke17: 'How do you make a tissue dance?\nPut a little boogie in it!',
      joke18: 'What do you call a nervous toilet?\nA potty-panic!',
      joke19: "Why don't sharks fart underwater?\nBecause then we'd all know!",
      joke20: "What do sharks call their bathroom?\nThe SPLASH-room!",

      /* ---- Bob's ocean facts (5) ---- */
      fact1: 'The ocean covers over 70% of the Earth!',
      fact2: 'Octopuses have three hearts and blue blood!',
      fact3: 'Sea otters hold hands while they sleep so they don\'t drift apart!',
      fact4: 'Dolphins sleep with one eye open!',
      fact5: 'A group of jellyfish is called a "smack"!',

      /* ---- Crab jokes (8) – kid-friendly, crab-themed ---- */
      crabJoke1: 'Why did the crab cross the beach?\nTo get to the OTHER tide!',
      crabJoke2: 'How do crabs call each other?\nOn their SHELL phones!',
      crabJoke3: "What do you get when a crab borrows a book?\nA crabby READ!",
      crabJoke4: 'Why are crabs so bad at sharing?\nThey\'re a little SHELLfish!',
      crabJoke5: 'What music do crabs love?\nAnything with a SNAPPY beat!',
      crabJoke6: "Why don't crabs give to charity?\nBecause they\'re shellfish… still!",
      crabJoke7: "What did the crab say at the gym?\nNo pinch, no gain!",
      crabJoke8: 'Why was the crab embarrassed?\nThe sea-weed!',

      /* ---- Boss ---- */
      heroChallenge: 'Moni! Free my ocean home – right now!',
      moniTaunt1: 'This ocean belongs to ME!',
      moniTaunt2: 'You cannot stop me, little Peach girl!',
      moniTaunt3: "Pesky bubbles! I'll sink you to the trench!",
      moniDefeat: 'Nooo! My dark magic is… fading…',
      moniApology: "I… I'm sorry. I only wanted friends…",
      heroVictory: "Then swim beside us, Moni. The ocean has room for everyone!",
    },

    ja: {
      /* ---- タイトル画面 ---- */
      title: 'モモコの海の世界',
      titleSubtitle: '〜 うみのだいぼうけん 〜',
      play: 'スタート',
      howToPlay: 'あそびかた',
      instructions: 'およぐ: やじるしキー / 十字ボタン\nあわをうつ: スペース / あわボタン\nてきをたおして うみをすくおう!',
      language: 'ことば',
      langLabel: 'JP',
      rotateHint: 'デバイスを よこむきにしてください！',
      bubbleBtn: 'あわ',
      soundOn: 'おと: オン',
      soundOff: 'おと: オフ',

      /* ---- イントロ / ものがたり ---- */
      introTitle: 'モモコのものがたり',
      introText: 'なみのふかいところに モモコのだいすきな うみのおうちが あります。\nモモコは うみの ももプリンセス。ちいさいけど とても ゆうかんです。\n\nあるひ わるいにんぎょの モニが やみのまほうを かけました。\nサンゴは つめたくなり さかなは にげだしました。\nモモコの ともだちは やみに とらわれてしまいました。\n\nにじいろの あわガンと ゆうかんな こころだけで\nふかいうみに もぐって せかいを すくわなくては なりません。\n\nモモコを てつだってくれる？',
      continueBtn: 'つぎへ',

      /* ---- HUD / ゲームプレイ ---- */
      paused: 'ポーズ',
      resume: 'つづける',
      quit: 'やめる',
      hearts: 'ハート',
      bossHP: 'モニ',

      /* ---- ゲームオーバー / 勝利 ---- */
      gameOver: 'ゲームオーバー',
      tryAgain: 'もういちど',
      victory: 'やったー！',
      savedOcean: 'うみをすくったよ！',
      playAgain: 'もういちど あそぶ',
      thanks: 'あそんでくれて ありがとう！',

      /* ---- ビーチ ---- */
      beachTitle: 'ビーチだ！',
      beachTitleAlt1: 'ひなたぼっこ！',
      beachTitleAlt2: 'うみのうえ こんにちは！',
      beachTitleAlt3: 'ビーチに とうちゃく！',
      beachText: 'みんな ビーチで たのしんでるよ！\nうみにもどろう！',
      beachTextAlt1: 'しおかぜが きもちいい！\nモニが まだ したで まってるよ…',
      beachTextAlt2: 'ウルフが しっぽを ふってるよ！\nモニは いつまでも まっては くれないよ！',
      beachTextAlt3: 'なみが よんでるよ…\nもう いちど もぐる？',
      back: 'もぐる',

      /* ---- カスタマイズ ---- */
      customize: 'モモコをカスタマイズ',
      presets: 'クイックスタイル',
      hairColor: 'かみ',
      suitColor: 'スーツ',
      skinTone: 'はだ',
      startGame: 'スタート！',
      presetOcean: 'うみのプリンセス',
      presetExplorer: 'しんかいたんけんか',
      presetRainbow: 'にじいろダイバー',
      presetCoral: 'サンゴのじょおう',
      presetNight: 'よるのスイマー',
      /* タブ */
      tabHair: 'かみがた',
      tabDress: 'ドレス',
      tabSwim: 'みずぎ',
      tabShoes: 'くつ',
      tabCrab: 'カニさん',
      tabFood: 'たべもの',
      /* バリエーション */
      varTwinTails: 'ツインテール',
      varLongBraids: 'ながいみつあみ',
      varBuns: 'おだんご',
      varFrillyDress: 'フリル',
      varSailorDress: 'セーラー',
      varStarDress: 'スター',
      varSailorSwimsuit: 'セーラー',
      varOnePiece: 'ワンピース',
      varFrillyBikini: 'ビキニ',
      varMaryJane: 'ストラップ',
      varSneaker: 'スニーカー',
      varFlipper: 'フィン',
      varNone: 'なし',
      varCrabRed: 'あか',
      varCrabBlue: 'あお',
      varCrabGold: 'きん',
      varIceCream: 'アイス',
      varOnigiri: 'おにぎり',
      varDonut: 'ドーナツ',
      varCrepe: 'クレープ',
      varTaiyaki: 'たいやき',
      varParfait: 'パフェ',
      varMacaron: 'マカロン',
      varStrawberry: 'いちご',

      /* ---- NPC ---- */
      oliverGreet: 'やあ モモコ！ジョークをきく？',
      kittyGreet: 'こんにちは！キティコーンだよ！きをつけて、わるいにんぎょのモニがこのさきにいるよ！',
      kittyHint: 'にじいろのあわで やっつけて！がんばって！',
      bobGreet: 'やあ！うみのはかせ、ボブだよ！しってた？',
      crabName: 'カニさん',

      /* ---- オリバーのうんちジョーク (20) ---- */
      joke1: 'トイレットペーパーは なぜ さかを ころがったの？\nいちばん したへ いきたかったから！',
      joke2: 'かいぞくの だいすきな トイレは？\nうんちデッキ！',
      joke3: 'ガイコツは なぜ うんちを しないの？\nないぞうが ないから！',
      joke4: 'トイレが もう ひとつの トイレに なんていった？\n「かおが まっかだよ！」',
      joke5: 'うんちが どうろを わたったのは なぜ？\nころころ ころがってたから！',
      joke6: 'おならを する きょうりゅうは？\nブーブーザウルス！',
      joke7: 'ちゃいろくて ネバネバ するのは なに？\nえだ！',
      joke8: 'さかなは どこで トイレに いくの？\nどこでも じゃーっと！',
      joke9: 'おならは なぜ くさいの？\nはなが きこえない ひとも たのしめるように！',
      joke10: 'みえなくて バナナの においが するのは？\nサルの ゲップ！',
      joke11: 'クジラの おならは なんていう？\nあわあわ ブーブー！',
      joke12: 'バナナが トイレに いったのは なぜ？\nわかれたく なったから！',
      joke13: 'こどもが パーティーに トイレットペーパーを もってきたのは なぜ？\nパーティーを ぶちこわす ひと だったから！',
      joke14: 'ちゃいろくて うるさいのは？\nチョコプリンが いっぱいの トランペット！',
      joke15: 'ハエは なぜ うんちに とまるの？\nくさい おやつが すきだから！',
      joke16: 'くさい ようせいは だれ？\nスティンカーベル！',
      joke17: 'ティッシュを おどらせるには？\nはなくそを ちょっと いれて！',
      joke18: 'こわがりの トイレは？\nドキドキ ポッティ！',
      joke19: 'サメは なぜ みずの なかで おならしないの？\nみんなに バレちゃうから！',
      joke20: 'サメの トイレは なんていう？\nスプラッシュルーム！',

      /* ---- ボブの海の知識 (5) ---- */
      fact1: 'うみは ちきゅうの70%いじょうを おおっているよ！',
      fact2: 'タコには こころぞうが3つ あるんだよ！ちも あおいんだ！',
      fact3: 'ラッコは ねるとき てをつないで はなれないようにするよ！',
      fact4: 'イルカは かたほうのめを あけて ねるんだよ！',
      fact5: 'クラゲのむれは 「スマック」 っていうんだよ！',

      /* ---- カニのジョーク (8) ---- */
      crabJoke1: 'カニは なぜ すなはまを わたったの？\nむこうの しおまで いきたかったから！',
      crabJoke2: 'カニは どうやって でんわするの？\nカラフォン （かいでんわ）！',
      crabJoke3: 'カニが ほんを よむと？\nカリカリの どくしょタイム！',
      crabJoke4: 'カニは なぜ シェアが にがて？\nだって ちょっと “カラに こもりがち” なんだもん！',
      crabJoke5: 'カニが すきな おんがくは？\nノリの いい ハサミビート！',
      crabJoke6: 'カニは なぜ きまえが わるい？\nだって カラに こもっているから！',
      crabJoke7: 'カニが ジムで いったことばは？\n“はさまずして えいこうなし！”',
      crabJoke8: 'カニが はずかしがった りゆうは？\nワカメ（みられた）！',

      /* ---- ボス ---- */
      heroChallenge: 'モニ！わたしの うみを かえして！いますぐ！',
      moniTaunt1: 'このうみは ワタシのもの！',
      moniTaunt2: 'ちいさな ももむすめに まけないわ！',
      moniTaunt3: 'うるさい あわ！しんかいに しずめて あげる！',
      moniDefeat: 'やられた…！わたしの やみのまほうが…きえていく…',
      moniApology: 'ごめん…わたし、ともだちが ほしかっただけなの…',
      heroVictory: 'それなら いっしょに およごう、モニ。うみは みんなのものだよ！',
    }
  };

  var currentLang = 'en';

  window.Game = window.Game || {};
  window.Game.i18n = {
    lang: currentLang,

    setLanguage: function (lang) {
      if (strings[lang]) {
        currentLang = lang;
        this.lang = lang;
      }
    },

    toggleLanguage: function () {
      this.setLanguage(currentLang === 'en' ? 'ja' : 'en');
    },

    t: function (key) {
      return (strings[currentLang] && strings[currentLang][key]) ||
             (strings.en && strings.en[key]) ||
             key;
    },

    getJoke: function () {
      var n = Math.floor(Math.random() * 20) + 1;
      return this.t('joke' + n);
    },

    getFact: function () {
      var n = Math.floor(Math.random() * 5) + 1;
      return this.t('fact' + n);
    },

    getCrabJoke: function () {
      var n = Math.floor(Math.random() * 8) + 1;
      return this.t('crabJoke' + n);
    }
  };
})();
