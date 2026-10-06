// Sample texts for the "try it" buttons. SAMPLES[0] is kept in sync with eval/demo_script_ar.txt
// (also used by the backend regression test).
export const SAMPLES = [
  {
    id: "post",
    label: "منشور دعوي",
    hint: "منشور بآيات وأحاديث: إحالة خاطئة، ولفظ مزيد، وحديث ضعيف، ونص لا أصل له",
    text: `التعارف بين الشعوب أصل في رسالة الإسلام، قال تعالى: ﴿يَا أَيُّهَا النَّاسُ إِنَّا خَلَقْنَاكُم مِّن ذَكَرٍ وَأُنثَىٰ وَجَعَلْنَاكُمْ شُعُوبًا وَقَبَائِلَ لِتَعَارَفُوا﴾ [الحجرات: 13].

والإسلام لا يُكره أحدًا على الدخول فيه، قال تعالى: ﴿لَا إِكْرَاهَ فِي الدِّينِ﴾ [البقرة: 265].

والعبرة عند الله بالقلوب، قال رسول الله ﷺ: «إن الله لا ينظر إلى صوركم وأموالكم ولكن ينظر إلى قلوبكم وأعمالكم» (رواه البخاري).

ومن أخلاق المسلم أن يحب الخير للناس، قال النبي ﷺ: «لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه من الخير» (متفق عليه).

وقال رسول الله ﷺ: «من حسن إسلام المرء تركه ما لا يعنيه».

وقال رسول الله ﷺ: «طلب العلم فريضة على كل مسلم» (رواه ابن ماجه).

وقال رسول الله ﷺ: «النظافة من الإيمان».
`,
  },
  {
    id: "popular",
    label: "عبارات شائعة",
    hint: "نصوص منتشرة على وسائل التواصل: حديث لا أصل له، وكتاب خاطئ، وآية بلفظ محرّف، وحديث قُدّم على أنه آية",
    text: `من العبارات المنتشرة في المنشورات الدعوية:

قال رسول الله ﷺ: «اطلبوا العلم ولو بالصين» (رواه البخاري).

وفي الأمانة قال ﷺ: «من غشنا فليس منا» (رواه البخاري).

وقال يعقوب عليه السلام: ﴿ولا تيأسوا من رحمة الله﴾ [يوسف: 87].

ويقول الله تعالى في كتابه العزيز: ﴿إنما الأعمال بالنيات﴾.
`,
  },
  {
    id: "plain",
    label: "اقتباسات غير منصّصة",
    hint: "آية وأحاديث وقول منسوب داخل الكلام، دون علامات تنصيص أو إحالات",
    text: `من أجمل ما يُعلَّم للناشئة أن المسلم من سلم المسلمون من لسانه ويده، وأن الدين النصيحة كما ثبت عن نبينا الكريم. وقد ذكّرنا ربنا في كتابه بأنه لا إكراه في الدين، فالدعوة بالحكمة لا بالإجبار. ويُنسب إلى عمر بن الخطاب قوله: متى استعبدتم الناس وقد ولدتهم أمهاتهم أحرارا.
`,
  },
  {
    id: "english",
    label: "بالإنجليزية",
    hint: "منشور بالإنجليزية: حديثان وآية مترجمة، تُقارن بالترجمة المعتمدة",
    text: `Islam teaches mercy and good character. The Messenger of Allah said that the strong man is not the one who wrestles others down, but the one who controls himself when angry (Bukhari). He also said "None of you truly believes until he loves for his brother what he loves for himself" (Muslim). And the Quran says: "There is no compulsion in religion" (2:256).
`,
  },
] as const;

export const SAMPLE_TEXT = SAMPLES[0].text;

export const REPO_URL = "https://github.com/techno-sd/mizan";
export const METHOD_URL = `${REPO_URL}/blob/main/docs/METHOD.md`;

export const fmt = (n: number) => n.toLocaleString("en-US");

// Arabic number agreement: 1 اقتباسًا واحدًا، 2 اقتباسين، 3-10 اقتباسات، 11-99 اقتباسًا، 100+ follows the last two digits.
export function countQuotes(n: number): string {
  if (n === 1) return "اقتباسًا واحدًا";
  if (n === 2) return "اقتباسين";
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${fmt(n)} اقتباسات`;
  if (r >= 11 && r <= 99) return `${fmt(n)} اقتباسًا`;
  return `${fmt(n)} اقتباس`;
}
