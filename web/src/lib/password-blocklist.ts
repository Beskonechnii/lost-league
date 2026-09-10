// Чёрный список паролей: то, что перебиратель попробует в первую тысячу попыток.
//
// Зачем свой список, а не пакет. Готовые блоклисты — это десятки тысяч строк англоязычной классики,
// и они целиком мимо нашей аудитории: у нас люди набирают русское слово в английской раскладке
// (`ghbdtn`, `gfhjkm`) и оно ни в одном зарубежном списке не встречается. Плюс лишняя зависимость
// в рантайме ради константы — цена без выгоды. Здесь около двух сотен строк: топ утечек, ряды
// с клавиатуры, имена и раскладочные слова. Этого хватает, чтобы отсечь очевидное; всё остальное
// ловят длина (PASSWORD_MIN) и лимит попыток входа.
//
// Правила ведения: только нижний регистр, только «основы» без хвостов из цифр — хвосты снимает
// сам сравниватель (`password-rules.ts`), поэтому `password123` держать здесь не нужно.

export const PASSWORD_BLOCKLIST: readonly string[] = [
  // ── цифровые ряды и «узоры» на цифровой части клавиатуры ──
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "12345",
  "123123",
  "123321",
  "112233",
  "121212",
  "111111",
  "1111111111",
  "000000",
  "0000000000",
  "222222",
  "333333",
  "444444",
  "555555",
  "666666",
  "777777",
  "888888",
  "999999",
  "101010",
  "123654",
  "654321",
  "987654321",
  "9876543210",
  "159753",
  "147258369",
  "741852963",
  "11223344",
  "12341234",
  "10203040",
  "31415926",
  // ── ряды и «змейки» с буквенной клавиатуры ──
  "qwerty",
  "qwertyu",
  "qwertyui",
  "qwertyuiop",
  "poiuytrewq",
  "asdfgh",
  "asdfghjk",
  "asdfghjkl",
  "lkjhgfdsa",
  "zxcvbn",
  "zxcvbnm",
  "mnbvcxz",
  "qweasd",
  "qweasdzxc",
  "qazwsx",
  "qazwsxedc",
  "1q2w3e",
  "1q2w3e4r",
  "1q2w3e4r5t",
  "q1w2e3r4",
  "q1w2e3r4t5",
  "1qaz2wsx",
  "1qazxsw2",
  "zaq12wsx",
  "1234qwer",
  "qwer1234",
  "qweqwe",
  "asdasd",
  "zxczxc",
  "wasdwasd",
  "azerty",
  "azertyuiop",
  "йцукен",
  "йцукенгш",
  "фывапролд",
  "ячсмитьбю",
  // ── классика утечек ──
  "password",
  "passw0rd",
  "p@ssw0rd",
  "passwords",
  "parol",
  "letmein",
  "welcome",
  "admin",
  "adminadmin",
  "administrator",
  "root",
  "rootroot",
  "toor",
  "master",
  "masterkey",
  "shadow",
  "secret",
  "access",
  "login",
  "guest",
  "test",
  "testtest",
  "changeme",
  "default",
  "temporary",
  "whatever",
  "trustno1",
  "abc123",
  "abcdef",
  "abcdefgh",
  "aaaaaa",
  "aaaaaaaaaa",
  "iloveyou",
  "loveyou",
  "lovelove",
  "hello",
  "helloworld",
  "hellohello",
  "freedom",
  "forever",
  "sunshine",
  "starwars",
  "computer",
  "internet",
  "samsung",
  "google",
  "facebook",
  "yandex",
  "gmail",
  "yahoo",
  "steam",
  "steamsteam",
  "dota",
  "dotadota",
  "dota2000",
  "counterstrike",
  "minecraft",
  "pokemon",
  "superman",
  "batman",
  "spiderman",
  "football",
  "baseball",
  "basketball",
  "soccer",
  "hockey",
  "dragon",
  "monkey",
  "ninja",
  "killer",
  "hunter",
  "ranger",
  "buster",
  "matrix",
  "phoenix",
  "flower",
  "chocolate",
  "cookie",
  "pepper",
  "princess",
  "angel",
  "summer",
  "winter",
  "purple",
  "orange",
  "silver",
  "diamond",
  "michael",
  "jennifer",
  "jessica",
  "michelle",
  "jordan",
  "george",
  "charlie",
  "andrew",
  "daniel",
  "robert",
  "thomas",
  "jackson",
  "harley",
  "tigger",
  // ── русские слова, набранные в английской раскладке ──
  "ghbdtn", // привет
  "ghbdtnghbdtn",
  "gfhjkm", // пароль
  "gfhjkmgfhjkm",
  "gfhjkm12", // «пароль12» — так его чаще всего и «усложняют»
  "rjvgm.nth", // компьютер
  "ntktajy", // телефон
  "ljnf", // дота
  "buhjr", // игрок
  "buhs", // игры
  "xtvgbjy", // чемпион
  "rjvfylf", // команда
  "hjccbz", // россия
  "vjcrdf", // москва
  "cjkywt", // солнце
  "cjkysirj", // солнышко
  "k.,jdm", // любовь
  "rhfcbdfz", // красивая
  "pfqxbr", // зайчик
  "rjntyjr", // котенок
  "rjirf", // кошка
  "cegthgfhjkm", // суперпароль
  "ytpyf.", // незнаю
  "yfnfif", // наташа
  "yfnfkmz", // наталья
  "cthutq", // сергей
  "fylhtq", // андрей
  "fktrctq", // алексей
  "fktrcfylh", // александр
  "lvbnhbq", // дмитрий
  "vfrcbv", // максим
  "tdutybq", // евгений
  "dkflbvbh", // владимир
  "dbrnjh", // виктор
  "ybrjkfq", // николай
  "trfnthbyf", // екатерина
  "vfhbyf", // марина
  "cdtnkfyf", // светлана
  "gjkbyf", // полина
  "vfvfvfvf", // мамамама
  // ── русские слова как есть (кириллицей их тоже набирают) ──
  "пароль",
  "привет",
  "россия",
  "любовь",
  "солнышко",
  "наташа",
  "сергей",
  "максим",
];
