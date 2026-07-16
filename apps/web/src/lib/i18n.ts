export const locales = ["uk", "en", "ru"] as const;
export type Locale = typeof locales[number];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

const messages = {
  en: {
    home: {
      howToPlay: "How to play", profile: "Profile", eyebrow: "Classic draw dominoes",
      title: "A good game.", titleAccent: "Beautifully simple.",
      intro: "Settle in for a thoughtful match against the computer, or open a private table for a friend.",
      draw: "Draw", drawText: "No legal move? Take from the boneyard until a tile fits.",
      connect: "Connect", connectText: "Match either open end and shape the chain across the table.",
      win: "Reach 100", winText: "Win rounds, count the remaining pips, and be first to one hundred."
    },
    lobby: {
      playComputer: "Play the computer", computerHint: "A thoughtful, medium-level opponent",
      inviteFriend: "Invite a friend", inviteHint: "Create a private table and share a link",
      ready: "Your private table is ready.", invitationLink: "Invitation link", copy: "Copy",
      goToTable: "Go to your table", createError: "Could not create match"
    },
    game: {
      you: "You", opponent: "Opponent", round: "Round", firstTo: "first to", tiles: "tiles",
      opening: "Play the opening tile", boneyard: "Boneyard", yourTurn: "Your turn",
      thinking: "Opponent is thinking…", playLeft: "Play left", playRight: "Play right",
      cancel: "Cancel", draw: "Draw a tile", pass: "Pass", claimForfeit: "Claim timeout win", score: "Match score",
      opponentHand: "Opponent hand", chain: "Domino chain", hand: "Your hand", chooseSide: "Choose board side",
      won: "You won", lost: "You lost", playAgain: "Back to lobby", unavailable: "The table is unavailable", preparing: "Preparing the table",
      restoring: "Restoring the latest match state…", restoreError: "Could not restore match", moveError: "Move was not accepted"
    },
    invite: {
      privateTable: "Private table", title: "You have been invited",
      intro: "Choose a temporary name and join immediately. No account required.", guestName: "Guest name",
      placeholder: "Your name", join: "Take your seat", joining: "Joining…",
      shortName: "Enter at least 2 characters", unavailable: "Invitation is unavailable"
    },
    auth: {
      mode: "Authentication mode", signIn: "Sign in", create: "Create account",
      eyebrow: "Your seat is waiting", welcome: "Welcome back", join: "Join the table",
      signinText: "Continue your active matches and see your results.",
      signupText: "Choose a unique public name. You can sign in with email or phone.",
      username: "Username", identifier: "Email or phone", password: "Password", wait: "Please wait…",
      createMine: "Create my account", confirmation: "Check your email or phone for the confirmation message, then sign in.",
      invalidIdentifier: "Enter a valid email or E.164 phone number.", failed: "Authentication failed",
      footnote: "By continuing, you agree to fair play and respectful usernames."
    },
    profile: {
      title: "Profile", username: "Public username", language: "Language", signOut: "Sign out",
      loading: "Loading profile…", unavailable: "Profile is unavailable"
    }
  },
  uk: {
    home: {
      howToPlay: "Як грати", profile: "Профіль", eyebrow: "Класичне доміно з добором",
      title: "Гарна гра.", titleAccent: "Просто й красиво.",
      intro: "Зіграйте вдумливу партію проти комп’ютера або відкрийте приватний стіл для друга.",
      draw: "Добирайте", drawText: "Немає ходу? Беріть із базару, доки не знайдете відповідну кістку.",
      connect: "З’єднуйте", connectText: "Приставляйте однакові значення до відкритих кінців ланцюжка.",
      win: "Наберіть 100", winText: "Вигравайте раунди й першим наберіть сто очок."
    },
    lobby: {
      playComputer: "Грати з комп’ютером", computerHint: "Вдумливий суперник середнього рівня",
      inviteFriend: "Запросити друга", inviteHint: "Створіть приватний стіл і надішліть посилання",
      ready: "Ваш приватний стіл готовий.", invitationLink: "Посилання-запрошення", copy: "Копіювати",
      goToTable: "Перейти до столу", createError: "Не вдалося створити матч"
    },
    game: {
      you: "Ви", opponent: "Суперник", round: "Раунд", firstTo: "до", tiles: "кісток",
      opening: "Зробіть перший хід", boneyard: "Базар", yourTurn: "Ваш хід",
      thinking: "Суперник думає…", playLeft: "Покласти ліворуч", playRight: "Покласти праворуч",
      cancel: "Скасувати", draw: "Взяти кістку", pass: "Пас", claimForfeit: "Зарахувати технічну перемогу", score: "Рахунок матчу",
      opponentHand: "Рука суперника", chain: "Ланцюжок доміно", hand: "Ваша рука", chooseSide: "Оберіть бік столу",
      won: "Ви перемогли", lost: "Ви програли", playAgain: "До лобі", unavailable: "Стіл недоступний", preparing: "Готуємо стіл",
      restoring: "Відновлюємо останній стан матчу…", restoreError: "Не вдалося відновити матч", moveError: "Хід не прийнято"
    },
    invite: {
      privateTable: "Приватний стіл", title: "Вас запросили",
      intro: "Оберіть тимчасове ім’я та приєднуйтеся без реєстрації.", guestName: "Ім’я гостя",
      placeholder: "Ваше ім’я", join: "Зайняти місце", joining: "Приєднання…",
      shortName: "Введіть щонайменше 2 символи", unavailable: "Запрошення недоступне"
    },
    auth: {
      mode: "Режим входу", signIn: "Увійти", create: "Створити акаунт",
      eyebrow: "Ваше місце чекає", welcome: "З поверненням", join: "Приєднуйтесь до гри",
      signinText: "Продовжуйте активні матчі та переглядайте результати.",
      signupText: "Оберіть унікальне публічне ім’я. Увійти можна через email або телефон.",
      username: "Юзернейм", identifier: "Email або телефон", password: "Пароль", wait: "Зачекайте…",
      createMine: "Створити акаунт", confirmation: "Підтвердьте email або телефон, а потім увійдіть.",
      invalidIdentifier: "Введіть коректний email або номер телефону E.164.", failed: "Помилка автентифікації",
      footnote: "Продовжуючи, ви погоджуєтесь грати чесно й використовувати коректне ім’я."
    },
    profile: {
      title: "Профіль", username: "Публічний юзернейм", language: "Мова", signOut: "Вийти",
      loading: "Завантажуємо профіль…", unavailable: "Профіль недоступний"
    }
  },
  ru: {
    home: {
      howToPlay: "Как играть", profile: "Профиль", eyebrow: "Классическое домино с добором",
      title: "Хорошая игра.", titleAccent: "Просто и красиво.",
      intro: "Сыграйте вдумчивую партию против компьютера или откройте приватный стол для друга.",
      draw: "Добирайте", drawText: "Нет хода? Берите из базара, пока не найдётся подходящая кость.",
      connect: "Соединяйте", connectText: "Приставляйте одинаковые значения к открытым концам цепочки.",
      win: "Наберите 100", winText: "Выигрывайте раунды и первым наберите сто очков."
    },
    lobby: {
      playComputer: "Играть с компьютером", computerHint: "Вдумчивый соперник среднего уровня",
      inviteFriend: "Пригласить друга", inviteHint: "Создайте приватный стол и отправьте ссылку",
      ready: "Ваш приватный стол готов.", invitationLink: "Ссылка-приглашение", copy: "Копировать",
      goToTable: "Перейти к столу", createError: "Не удалось создать матч"
    },
    game: {
      you: "Вы", opponent: "Соперник", round: "Раунд", firstTo: "до", tiles: "костей",
      opening: "Сделайте первый ход", boneyard: "Базар", yourTurn: "Ваш ход",
      thinking: "Соперник думает…", playLeft: "Положить слева", playRight: "Положить справа",
      cancel: "Отмена", draw: "Взять кость", pass: "Пас", claimForfeit: "Засчитать техническую победу", score: "Счёт матча",
      opponentHand: "Рука соперника", chain: "Цепочка домино", hand: "Ваша рука", chooseSide: "Выберите сторону стола",
      won: "Вы победили", lost: "Вы проиграли", playAgain: "В лобби", unavailable: "Стол недоступен", preparing: "Готовим стол",
      restoring: "Восстанавливаем последнее состояние матча…", restoreError: "Не удалось восстановить матч", moveError: "Ход не принят"
    },
    invite: {
      privateTable: "Приватный стол", title: "Вас пригласили",
      intro: "Выберите временное имя и присоединяйтесь без регистрации.", guestName: "Имя гостя",
      placeholder: "Ваше имя", join: "Занять место", joining: "Подключение…",
      shortName: "Введите не менее 2 символов", unavailable: "Приглашение недоступно"
    },
    auth: {
      mode: "Режим входа", signIn: "Войти", create: "Создать аккаунт",
      eyebrow: "Ваше место ждёт", welcome: "С возвращением", join: "Присоединяйтесь к игре",
      signinText: "Продолжайте активные матчи и смотрите результаты.",
      signupText: "Выберите уникальное публичное имя. Войти можно по email или телефону.",
      username: "Юзернейм", identifier: "Email или телефон", password: "Пароль", wait: "Подождите…",
      createMine: "Создать аккаунт", confirmation: "Подтвердите email или телефон, а затем войдите.",
      invalidIdentifier: "Введите корректный email или номер телефона E.164.", failed: "Ошибка аутентификации",
      footnote: "Продолжая, вы соглашаетесь играть честно и использовать корректное имя."
    },
    profile: {
      title: "Профиль", username: "Публичный юзернейм", language: "Язык", signOut: "Выйти",
      loading: "Загружаем профиль…", unavailable: "Профиль недоступен"
    }
  }
} as const;

export function getMessages(locale: string) {
  return messages[isLocale(locale) ? locale : "en"];
}
