/**
 * Localized push notification & email strings.
 * Each key maps to a locale → { title, body } pair.
 * Body may contain placeholders like {{streak}} resolved at send-time.
 */

type NotificationStrings = {
  title: string;
  body: string;
};

type LocaleMap = Record<string, NotificationStrings>;

export const dailyScenario: LocaleMap = {
  en: { title: '🌶️ New scenario is here!', body: "Today's dilemma awaits your verdict!" },
  cs: { title: '🌶️ Nový scénář je tu!', body: 'Dnešní dilema čeká na tvůj verdikt!' },
  de: { title: '🌶️ Neues Szenario ist da!', body: 'Das heutige Dilemma wartet auf dein Urteil!' },
  es: { title: '🌶️ ¡Nuevo escenario disponible!', body: '¡El dilema de hoy espera tu veredicto!' },
  fr: { title: '🌶️ Nouveau scénario disponible !', body: "Le dilemme du jour attend votre verdict !" },
  pt: { title: '🌶️ Novo cenário disponível!', body: 'O dilema de hoje aguarda o seu veredicto!' },
  ja: { title: '🌶️ 新しいシナリオが届きました！', body: '今日のジレンマにあなたの判定を！' },
};

export const streakWarning: LocaleMap = {
  en: { title: '🔥 Streak at risk!', body: 'Your {{streak}}-day streak is at risk! Only a few hours left.' },
  cs: { title: '🔥 Streak v ohrožení!', body: 'Tvůj {{streak}}-denní streak je v ohrožení! Zbývá pár hodin.' },
  de: { title: '🔥 Streak in Gefahr!', body: 'Dein {{streak}}-Tage-Streak ist in Gefahr! Nur noch wenige Stunden.' },
  es: { title: '🔥 ¡Racha en peligro!', body: 'Tu racha de {{streak}} días está en peligro. ¡Quedan pocas horas!' },
  fr: { title: '🔥 Série en danger !', body: 'Votre série de {{streak}} jours est en danger ! Plus que quelques heures.' },
  pt: { title: '🔥 Sequência em risco!', body: 'Sua sequência de {{streak}} dias está em risco! Restam poucas horas.' },
  ja: { title: '🔥 連続記録がピンチ！', body: '{{streak}}日連続記録が途切れそうです！残り数時間です。' },
};

export const leaguePromotion: LocaleMap = {
  en: { title: '🏆 League Promotion!', body: "Congratulations! You've been promoted in the league!" },
  cs: { title: '🏆 Postup v lize!', body: 'Gratulujeme! Postoupil jsi v lize!' },
  de: { title: '🏆 Liga-Aufstieg!', body: 'Herzlichen Glückwunsch! Du bist in der Liga aufgestiegen!' },
  es: { title: '🏆 ¡Ascenso de liga!', body: '¡Felicidades! ¡Has ascendido en la liga!' },
  fr: { title: '🏆 Promotion de ligue !', body: 'Félicitations ! Vous avez été promu dans la ligue !' },
  pt: { title: '🏆 Promoção na liga!', body: 'Parabéns! Você foi promovido na liga!' },
  ja: { title: '🏆 リーグ昇格！', body: 'おめでとうございます！リーグで昇格しました！' },
};

export const leagueDemotion: LocaleMap = {
  en: { title: '📉 League Update', body: "You've been moved down a tier. Keep voting to climb back!" },
  cs: { title: '📉 Aktualizace ligy', body: 'Sestoupil jsi o úroveň. Hlasuj dál a vrať se zpět!' },
  de: { title: '📉 Liga-Update', body: 'Du bist eine Stufe abgestiegen. Stimm weiter ab, um zurückzukommen!' },
  es: { title: '📉 Actualización de liga', body: 'Has bajado un nivel. ¡Sigue votando para volver a subir!' },
  fr: { title: '📉 Mise à jour de ligue', body: 'Vous avez reculé d\'un rang. Continuez à voter pour remonter !' },
  pt: { title: '📉 Atualização da liga', body: 'Você desceu um nível. Continue votando para voltar!' },
  ja: { title: '📉 リーグ更新', body: '1つ下のティアに降格しました。投票を続けて巻き返しましょう！' },
};

export const leagueChampion: LocaleMap = {
  en: { title: '👑 League Champion!', body: 'You finished #1 in your league! Amazing!' },
  cs: { title: '👑 Šampión ligy!', body: 'Skončil jsi na 1. místě v lize! Úžasné!' },
  de: { title: '👑 Liga-Champion!', body: 'Du hast den 1. Platz in deiner Liga belegt! Fantastisch!' },
  es: { title: '👑 ¡Campeón de la liga!', body: '¡Terminaste en el puesto #1 de tu liga! ¡Increíble!' },
  fr: { title: '👑 Champion de la ligue !', body: 'Vous avez terminé n°1 de votre ligue ! Incroyable !' },
  pt: { title: '👑 Campeão da liga!', body: 'Você terminou em 1º lugar na liga! Incrível!' },
  ja: { title: '👑 リーグチャンピオン！', body: 'リーグで1位を獲得しました！素晴らしい！' },
};

export const passwordReset = {
  en: {
    subject: 'Reset your SpicyPick password',
    heading: 'You requested a password reset. Click the link below to set a new password:',
    button: 'Reset Password',
    footer: "This link expires in 1 hour. If you didn't request this, ignore this email.",
  },
  cs: {
    subject: 'Obnovení hesla SpicyPick',
    heading: 'Požádal jsi o obnovení hesla. Klikni na odkaz níže pro nastavení nového hesla:',
    button: 'Obnovit heslo',
    footer: 'Odkaz vyprší za 1 hodinu. Pokud jsi o obnovení nežádal, tento e-mail ignoruj.',
  },
  de: {
    subject: 'SpicyPick-Passwort zurücksetzen',
    heading: 'Du hast eine Passwort-Zurücksetzung angefordert. Klicke auf den Link, um ein neues Passwort festzulegen:',
    button: 'Passwort zurücksetzen',
    footer: 'Dieser Link läuft in 1 Stunde ab. Falls du dies nicht angefordert hast, ignoriere diese E-Mail.',
  },
  es: {
    subject: 'Restablece tu contraseña de SpicyPick',
    heading: 'Solicitaste un restablecimiento de contraseña. Haz clic en el enlace para establecer una nueva:',
    button: 'Restablecer contraseña',
    footer: 'Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.',
  },
  fr: {
    subject: 'Réinitialisez votre mot de passe SpicyPick',
    heading: 'Vous avez demandé une réinitialisation de mot de passe. Cliquez sur le lien ci-dessous :',
    button: 'Réinitialiser le mot de passe',
    footer: "Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet e-mail.",
  },
  pt: {
    subject: 'Redefinir sua senha do SpicyPick',
    heading: 'Você solicitou uma redefinição de senha. Clique no link abaixo para definir uma nova:',
    button: 'Redefinir senha',
    footer: 'Este link expira em 1 hora. Se você não solicitou isso, ignore este e-mail.',
  },
  ja: {
    subject: 'SpicyPickのパスワードリセット',
    heading: 'パスワードリセットのリクエストがありました。下のリンクをクリックして新しいパスワードを設定してください：',
    button: 'パスワードをリセット',
    footer: 'このリンクは1時間で失効します。リクエストした覚えがない場合は、このメールを無視してください。',
  },
} as const;

export const emailVerification = {
  en: {
    subject: 'Verify your SpicyPick email',
    heading: 'Please verify your email address to start playing SpicyPick. Click the link below:',
    button: 'Verify Email',
    footer: "If you didn't create a SpicyPick account, ignore this email.",
  },
  cs: {
    subject: 'Ověř svůj e-mail na SpicyPick',
    heading: 'Ověř svou e-mailovou adresu, aby ses mohl zapojit do SpicyPick. Klikni na odkaz níže:',
    button: 'Ověřit e-mail',
    footer: 'Pokud jsi účet nevytvářel, tento e-mail ignoruj.',
  },
  de: {
    subject: 'Bestätige deine SpicyPick-E-Mail',
    heading: 'Bitte bestätige deine E-Mail-Adresse, um SpicyPick zu spielen. Klicke auf den Link:',
    button: 'E-Mail bestätigen',
    footer: 'Wenn du kein SpicyPick-Konto erstellt hast, ignoriere diese E-Mail.',
  },
  es: {
    subject: 'Verifica tu correo de SpicyPick',
    heading: 'Verifica tu dirección de correo para comenzar a jugar SpicyPick. Haz clic en el enlace:',
    button: 'Verificar correo',
    footer: 'Si no creaste una cuenta en SpicyPick, ignora este correo.',
  },
  fr: {
    subject: 'Vérifiez votre adresse e-mail SpicyPick',
    heading: 'Veuillez vérifier votre adresse e-mail pour commencer à jouer à SpicyPick. Cliquez sur le lien :',
    button: "Vérifier l'e-mail",
    footer: "Si vous n'avez pas créé de compte SpicyPick, ignorez cet e-mail.",
  },
  pt: {
    subject: 'Verifique seu e-mail do SpicyPick',
    heading: 'Por favor, verifique seu endereço de e-mail para começar a jogar SpicyPick. Clique no link:',
    button: 'Verificar e-mail',
    footer: 'Se você não criou uma conta no SpicyPick, ignore este e-mail.',
  },
  ja: {
    subject: 'SpicyPickのメールアドレスを確認してください',
    heading: 'SpicyPickをプレイするには、メールアドレスを確認してください。下のリンクをクリック：',
    button: 'メールを確認する',
    footer: 'SpicyPickのアカウントを作成していない場合は、このメールを無視してください。',
  },
} as const;

/**
 * Resolve a localized notification string set, falling back to English.
 */
export function t(map: LocaleMap, locale: string, replacements?: Record<string, string | number>): NotificationStrings {
  const strings = map[locale] || map['en'];
  if (!replacements) return strings;

  let { title, body } = strings;
  for (const [key, value] of Object.entries(replacements)) {
    title = title.replaceAll(`{{${key}}}`, String(value));
    body = body.replaceAll(`{{${key}}}`, String(value));
  }
  return { title, body };
}
