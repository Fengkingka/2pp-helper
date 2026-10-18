/**
 * Lightweight client-side internationalisation for the PHP site.
 * Chinese remains the canonical content; English is applied to text nodes and
 * accessibility attributes at render time, including content created later by JS.
 */
(function () {
  'use strict';

  const TEXT = {
    "對話面試": "Conversational Interview",
    "開始對話面試": "Start conversational interview",
    "輪流對話：中文界面用粵語，英文界面用英語。5 條基礎問題，每題最多一次上下文追問；基礎問題不按 CV 生成。問答及報告語言在開始時鎖定。AI 不可用時會標示後備追問或示範評分。": "Turn-based interview: Cantonese in the Chinese interface, English in the English interface. Five base questions with at most one contextual follow-up each. Base questions are not CV-generated. Interview and report language are fixed at the start. Fallback questions and demo scores are labelled when AI is unavailable.",
    "上下文追問": "Contextual follow-up",
    "根據你的回答追問，最多一次；服務不可用時用標示清楚的後備問題。": "Up to one follow-up based on your answer. Preset fallback questions are clearly labelled if the service is unavailable.",
    "自動接話": "Automatic turns",
    "說完停頓約 2.5 秒自動提交，也可以按「答完了」；暫不支援打斷。": "Answers are submitted after a pause of about 2.5 seconds. You can also press Done answering. Interrupting the coach is not supported.",
    "DeepSeek 分析回答；錄音保留在本頁，語音指標只屬字幕估算。": "DeepSeek evaluates your answers. Recordings stay on this page; speech metrics are transcript estimates only.",
    "問答語言會在開始時鎖定；只錄咪高峰，請戴耳機。": "Interview language is fixed at the start. Microphone-only recording; please wear headphones.",
    "面試教練 · 原創角色": "Interview coach · Original character",
    "面試官提問中": "Coach speaking",
    "聆聽回答": "Listening to your answer",
    "語音暫時不可用；已有字幕已保留，請繼續用文字作答。": "Speech is unavailable. Your transcript has been kept; continue by typing.",
    "已改用文字作答；咪高峰已停止，已有回答及錄音會保留。": "Switched to typing. The microphone has stopped; existing answers and recording are preserved.",
    "本次語言的朗讀不可用，已改用文字；不會改用普通話或其他語言。": "Speech playback in this language is unavailable. Continue by typing; Mandarin or another language will not be substituted.",
    "請先輸入回答。": "Please enter an answer first.",
    "雲端轉錄未能完成，請用文字補回這個回答。已有錄音會保留。": "Cloud transcription failed. Please type this answer; your recording is preserved.",
    "未能識別回答，請改用文字作答。": "No answer was recognized. Please continue by typing.",
    "AI 追問": "AI follow-up",
    "後備追問": "Fallback follow-up",
    "MiniMax 雲端語音：每次回答片段會上傳轉錄，停頓後才顯示字幕；只下載本地咪高峰錄音。結束前請先提交回答；尚未轉錄的回答不會計入報告。": "MiniMax cloud speech: each answer clip is uploaded for transcription; captions appear after the pause. The downloadable microphone recording stays local. Submit your answer before ending; untranscribed answers are not included in the report.",
    "瀏覽器語音：停頓約 2.5 秒自動提交；可按「答完了」。問答語言在開始時鎖定，請戴耳機。": "Browser speech: answers are submitted after about 2.5 seconds without transcript updates. You can press Done answering. Interview language is fixed at the start; wear headphones.",
    "未能使用咪高峰，已改用文字作答。請檢查瀏覽器權限。": "Microphone access failed. Continue by typing and check browser permissions.",
    "MiniMax 語音已啟用；每次回答會上傳轉錄，停頓後顯示字幕，最長 60 秒自動提交。": "MiniMax speech enabled. Answer clips are uploaded for transcription; captions appear after the pause. Each answer is submitted after at most 60 seconds.",
    "MiniMax 尚未設定，先用瀏覽器語音。中文需要粵語聲音；沒有時改用文字，不改用普通話。識別需要網絡。": "MiniMax is not configured; browser speech is used. Chinese interviews need an installed Cantonese voice, otherwise typing is offered instead of Mandarin. Recognition requires a network connection.",
    "頁面已恢復；咪高峰已停止，請用文字繼續作答。": "The page has resumed. The microphone has stopped; continue by typing.",
    "下載錄音只留在本頁，不包含教練聲音。語音識別服務可能處理音頻；啟用 MiniMax 時會上傳每次回答片段轉錄。離開前請先下載。": "The downloadable recording stays on this page and excludes the coach. Speech recognition services may process audio; MiniMax uploads each answer clip for transcription when enabled. Download your recording before leaving.",
    "中文按字數計算，不套用英文詞數。語速及口頭禪只屬字幕估算，不能評估發音或語調。": "Chinese answers are counted in characters, not English words. Speaking pace and fillers are transcript estimates, not pronunciation or intonation assessments.",
    "回答字數": "Answer character count",
    "示範題庫：5 條固定英文問題，不按 CV 或職位生成。少於 30 個英文詞時，每題最多追加一次預設追問。完成後由 AI 按評分準則生成報告。": "Demo question bank: five fixed English questions. Answers under 30 words receive one scripted follow-up. Questions are not generated from your CV or role. AI evaluates your answers against the rubric at the end.",
    "評分報告": "Evaluation report",
    "評分報告與咪高峰錄音；語音指標由英文字幕估算。": "Evaluation report and microphone recording. Speech metrics are estimated from the English transcript.",
    "AI 評分報告已儲存在「我的報告」。": "Your AI evaluation report is saved in My Reports.",
    "AI 評分": "AI evaluation",
    "英文面試示範": "English Interview Demo",
    "英文示範": "English demo",
    "個人化面試": "Profile-based interview",
    "英文面試": "English Interview",
    "示範題庫：5 條固定英文問題，不按 CV 或職位生成。少於 30 個英文詞時，每題最多追加一次預設追問。示範評分，尚未連接 AI。": "Demo question bank: five fixed English questions. Answers under 30 words receive one scripted follow-up. Questions are not generated from your CV or role. Scores are illustrative; AI is not connected.",
    "目標職位（只作報告標題）": "Target role (report title only)",
    "開始英文面試": "Start English interview",
    "2 條經歷題、2 條行為題、1 條情境題；次序固定。": "Two experience questions, two behavioural questions and one situational question, in a fixed order.",
    "預設追問": "Scripted follow-up",
    "少於 30 個英文詞會追問一次，不是 AI 分析。": "Answers under 30 words receive one scripted follow-up.",
    "示範報告與咪高峰錄音；語音指標由英文字幕估算。": "Sample report and microphone recording. Speech metrics are estimated from the English transcript.",
    "示範題庫 · 英文問答 · 只錄咪高峰，不包含教練聲音；請戴耳機。": "Demo question bank · English questions and answers · Records your microphone only, not the coach. Please wear headphones.",
    "原創面試教練：待機、聆聽、思考、說話四種狀態": "Original interview coach with idle, listening, thinking and speaking states",
    "英文面試教練 · 原創角色": "English interview coach · Original character",
    "你的英文回答": "Your English answer",
    "錄音只有咪高峰聲音，不包含教練朗讀，亦不會上傳。錄音只留在本頁，離開前請先下載。": "The recording contains your microphone only, not the coach, and is not uploaded. It is kept on this page only. Download it before leaving.",
    "英文提問中": "Asking in English",
    "聆聽英文回答": "Listening to your English answer",
    "整理回答中": "Processing your answer",
    "語音識別或錄音暫時不可用；已有字幕已保留，請繼續用英文文字作答。": "Speech recognition or recording is unavailable. Your transcript has been preserved. Continue by typing in English.",
    "已改用英文文字作答；咪高峰已停止，之前的錄音會在完結後提供下載。": "Switched to typed English answers. The microphone has stopped. Your earlier recording will be available to download at the end.",
    "英文朗讀暫時不可用，已改用文字。請閱讀問題並用英文回答。": "Speech playback is unavailable. Read the question and type your answer in English.",
    "還未聽到回答。請再說一次，或改用文字作答。": "No answer detected. Speak again or switch to typing.",
    "請先輸入英文回答。": "Please enter an English answer first.",
    "正在產生示範報告……": "Generating your sample report…",
    "示範報告已儲存在「我的報告」。尚未連接 AI，分數只按簡單規則估算。": "Your sample report is saved in My Reports. AI is not connected; scores are estimated using simple rules.",
    "正在整理錄音……": "Preparing your recording…",
    "示範題庫未準備好，請稍後再試。": "The demo question bank is unavailable. Please try again later.",
    "未能使用咪高峰，已改用英文文字作答。請檢查瀏覽器權限。": "Microphone access failed. Continue by typing in English, or check your browser permissions.",
    "免費瀏覽器語音；英文識別需要網絡。只錄咪高峰，請戴耳機。": "Browser speech is free to use. English recognition requires an internet connection. Only your microphone is recorded; please wear headphones.",
    "此瀏覽器不支援完整語音功能，會改用英文文字作答；建議桌面版 Chrome。": "This browser does not support all speech features. Continue by typing in English. Desktop Chrome is recommended.",
    "頁面已恢復；咪高峰已停止，請用英文文字繼續作答。": "The page has resumed. The microphone has stopped. Continue by typing in English.",
    "經歷題": "Experience",
    "英文回答詞數": "English answer word count",
    "回答速度（詞/分鐘，含停頓）": "Speaking pace (words per minute, including pauses)",
    "英文口頭禪（字幕估算）": "English filler words (transcript estimate)",
    "此報告使用示範評分，分數按簡單規則估算": "This report uses illustrative scores estimated with simple rules",
    "語音指標只計語音提交的回答。速度從首次出現字幕至提交計時，包含停頓；口頭禪按字幕中的 um、uh、you know、I mean 計數。識別可能省略語氣詞，這是字幕估算，不是專業語音評估。": "Speech metrics cover spoken answers only. Pace is measured from the first transcript to submission, including pauses. Fillers count um, uh, you know and I mean in the transcript. Recognition may omit fillers; these are transcript estimates, not a professional speech assessment.",
    "根據你的 CV 和目標職位練習：中文界面用粵語，英文界面用英語。2 條 CV 題、2 條行為題、1 條情境題或行業認知題；每題最多一次上下文追問。問答及報告語言在開始時鎖定。": "Practise for your target role using your CV: Cantonese in the Chinese interface and English in the English interface. Two CV questions, two behavioural questions and one situational or industry-awareness question, with at most one contextual follow-up each. Interview and report language are fixed at the start.",
    "[平台名稱]": "[Platform Name]",
    "語言": "Language",
    "主要導航": "Main navigation",
    "返回首頁": "Back to home",
    "返回創業者路線": "Back to Founder Path",
    "返回路線總覽": "Back to path overview",
    "畢業生路線": "Graduate Path",
    "創業者路線": "Founder Path",
    "畢業生": "Graduate",
    "創業者": "Founder",
    "我的報告": "My Reports",
    "報告": "Reports",
    "私隱與資料": "Privacy & Data",
    "私隱": "Privacy",
    "路線總覽": "Path Overview",
    "建立資料與進度": "Set up your profile and track progress",
    "職涯方向": "Career Direction",
    "AI 助理": "AI Assistant",
    "AI 改寫與匯出": "AI rewrite and export",
    "工作與活動": "Jobs & Activities",
    "按你的資料推薦": "Recommendations based on your profile",
    "AI 面試教練": "AI Interview Coach",
    "語音模擬面試": "Voice mock interview",
    "公司設定與成本計算": "Company setup and cost calculator",
    "危機壓力測試": "Crisis stress test",
    "融資條款談判": "Funding term negotiation",
    "B2B 電郵練習": "B2B Email Practice",
    "應對企業採購": "Handle enterprise procurement",
    "即將推出": "Coming soon",
    "按順序走或隨時跳站都可以。": "Follow the path in order or jump to any station.",
    "不用登入，資料只留在你的瀏覽器。": "No sign-in required. Your data stays in your browser.",
    "清除我的資料": "Clear my data",

    "先練習，再上場": "Practise First. Step Up Ready.",
    "先練習，再上場。": "Practise first. Step up ready.",
    "先練習，": "Practise first.",
    "再上場。": "Step up ready.",
    "給應屆畢業生和初創創辦人的 AI 訓練場。找方向、寫 CV、練面試；或者在模擬中練談判、壓力測試營運計劃。": "An AI training ground for graduates and startup founders. Explore careers, build a CV and practise interviews—or rehearse negotiations and stress-test your operating plan.",
    "我是畢業生": "I'm a graduate",
    "我是創辦人": "I'm a founder",
    "你在這裡": "You are here",
    "找方向": "Find direction",
    "寫 CV": "Build a CV",
    "練面試": "Practise interviews",
    "練談判": "Negotiate",
    "壓力測試": "Stress test",
    "練銷售": "Practise sales",
    "選一條路線，按站練習": "Choose a path and practise station by station",
    "每條路線五個站。建議按順序走，但你隨時可以跳到任何一站。": "Each path has five stations. Follow them in order or jump to any station at any time.",
    "應屆畢業生、想轉行的人": "New graduates and career changers",
    "進入畢業生路線": "Enter Graduate Path",
    "建立資料": "Create your profile",
    "主修、興趣和技能，大約 2 分鐘。": "Add your major, interests and skills in about two minutes.",
    "AI 助理根據你的資料提出 2 至 3 條路徑。": "The AI assistant suggests two or three paths from your profile.",
    "把經歷改寫成成果句，匯出 PDF。": "Turn experience into impact statements and export a PDF.",
    "按主修和興趣推薦，連到外部網站。": "Get recommendations based on your major and interests.",
    "語音模擬面試，完結後出報告。": "Run a voice mock interview and get a report afterwards.",
    "初創創辦人、團隊": "Startup founders and teams",
    "進入創業者路線": "Enter Founder Path",
    "公司設定": "Company setup",
    "現金、收入、人手，或直接用示範公司。": "Enter cash, revenue and headcount, or use the demo company.",
    "運營成本計算器": "Operating Cost Calculator",
    "即時試算每月支出和 runway。": "Calculate monthly spending and runway instantly.",
    "危機突然出現，看公司生存還是破產。": "Face sudden crises and see whether the company survives.",
    "與投資者談條款，看退出時實得多少。": "Negotiate investor terms and see your proceeds at exit.",
    "回覆企業採購經理的各種異議。": "Respond to objections from an enterprise procurement manager.",
    "每次練習，都有一份報告": "Every practice session comes with a report",
    "報告逐項評分，並引用你自己寫過或講過的句子，告訴你下一次可以怎樣做。": "Each report scores every dimension, quotes your own words and shows what to improve next time.",
    "數字由程式計算": "Numbers calculated by code",
    "股權、退出分配和現金流都由計算器算出，AI 不會自行估算數字。": "Equity, exit proceeds and cash flow come from calculators—not AI estimates.",
    "按評分準則評分": "Scored against clear rubrics",
    "每個分數都有清楚的級別描述，並引用你的原句作證據。": "Every score has a clear level description and cites your own words as evidence.",
    "資料只留在你的瀏覽器": "Data stays in your browser",
    "不用登入，也沒有資料庫。你可以隨時一鍵清除所有資料。": "There is no sign-in or database. Clear all your data at any time.",
    "報告：B2B 電郵練習": "Report: B2B Email Practice",
    "示範": "Demo",
    "能回應合規疑慮，但未量化 ROI。": "Addresses compliance concerns but does not quantify ROI.",
    "回應異議": "Handling objections",
    "以 ROI 說服": "Using ROI persuasively",
    "行動呼籲": "Call to action",
    "「我們的系統功能很多……」": "“Our system has many features…”",
    "把節省的人手時數換算成金額，再寫進第一段。": "Convert staff hours saved into a monetary figure and add it to the opening paragraph.",
    "比賽示範版本": "competition demo",
    "[平台名稱] 比賽示範版本": "[Platform Name] competition demo",
    "內容只作教育用途，並非法律、投資或職業意見。": "For educational use only; not legal, investment or career advice.",

    "畢業生路線 _01": "Graduate Path _01",
    "畢業生路線 _02": "Graduate Path _02",
    "畢業生路線 _03": "Graduate Path _03",
    "畢業生路線 _04": "Graduate Path _04",
    "畢業生路線 _05": "Graduate Path _05",
    "先建立你的資料": "Start with your profile",
    "其他站點都會用這份資料，你只需要填一次。": "The other stations use this profile, so you only need to enter it once.",
    "載入示範資料": "Load demo profile",
    "主修": "Major",
    "請選擇": "Select one",
    "畢業年份": "Graduation year",
    "學校（可選）": "School (optional)",
    "[大學名稱]": "[University name]",
    "你現在的情況": "Your current situation",
    "應屆畢業": "New graduate",
    "想轉行": "Career changer",
    "興趣（可多選）": "Interests (select all that apply)",
    "技能（用逗號分隔）": "Skills (comma-separated)",
    "例如：Excel, Canva, Python 基礎": "e.g. Excel, Canva, Python basics",
    "目標職位（可以留空，讓 AI 助理建議）": "Target role (leave blank for AI suggestions)",
    "例如：Marketing Analyst": "e.g. Marketing Analyst",
    "我們不會問你的性別或年齡。": "We will not ask for your gender or age.",
    "儲存並找方向": "Save and explore careers",
    "你的路線": "Your path",
    "主修、興趣、技能和目標職位": "Major, interests, skills and target role",
    "AI 助理提出 2 至 3 條路徑": "The AI assistant suggests two or three paths",
    "改寫成果句，匯出 PDF": "Rewrite impact statements and export a PDF",
    "按你的資料推薦": "Recommendations based on your profile",
    "語音模擬面試及報告": "Voice mock interview and report",
    "未開始": "Not started",
    "已完成": "Completed",
    "下一站": "Up next",
    "已載入示範資料。": "Demo profile loaded.",
    "請選擇主修。": "Please select your major.",
    "請填寫四位數字的畢業年份，例如 2026。": "Enter a four-digit graduation year, such as 2026.",

    "市場學": "Marketing",
    "工商管理": "Business Administration",
    "會計": "Accounting",
    "金融": "Finance",
    "經濟學": "Economics",
    "統計學": "Statistics",
    "數學": "Mathematics",
    "電腦科學": "Computer Science",
    "資訊科技": "Information Technology",
    "傳理": "Communications",
    "設計": "Design",
    "心理學": "Psychology",
    "社會科學": "Social Sciences",
    "其他": "Other",
    "品牌": "Branding",
    "數據分析": "Data Analytics",
    "內容創作": "Content Creation",
    "科技產品": "Tech Products",
    "社會創新": "Social Innovation",
    "營運管理": "Operations Management",
    "初創企業": "Startups",
    "Python 基礎": "Python Basics",

    "職涯方向 AI 助理": "Career Direction AI Assistant",
    "與 AI 助理對話": "Chat with the AI assistant",
    "角色": "Role",
    "根據你的資料，最多問 3 條問題": "Uses your profile and asks up to three questions",
    "輸入訊息": "Type a message",
    "例如：哪條路徑最快入行？": "e.g. Which path offers the quickest entry?",
    "傳送": "Send",
    "可行的職涯路徑": "Viable career paths",
    "重新建議": "Refresh suggestions",
    "路徑": "Path",
    "路徑 A": "Path A",
    "路徑 B": "Path B",
    "路徑 C": "Path C",
    "現在的你": "Where you are now",
    "補足技能": "Build missing skills",
    "第一份工作": "First role",
    "18 個月後": "After 18 months",
    "為甚麼適合你": "Why it suits you",
    "技能差距": "Skill gap",
    "第一個 30 日": "First 30 days",
    "要留意": "Watch out",
    "練這個職位的面試": "Practise an interview for this role",
    "看相關機會": "See related opportunities",
    "正在按你的資料整理路徑……": "Building paths from your profile…",
    "AI 助理正在回覆": "AI assistant is replying",
    "先建立你的資料，AI 助理才能建議路徑。": "Create your profile before asking the AI assistant for paths.",

    "市場數據分析": "Marketing Analytics",
    "品牌與內容策劃": "Brand & Content Planning",
    "電子商務營運": "E-commerce Operations",
    "初級數據分析": "Junior Data Analytics",
    "營運與項目統籌": "Operations & Project Coordination",
    "初創企業多面手": "Startup Generalist",
    "補足 SQL 和網站分析工具": "Build SQL and web analytics skills",
    "負責一條產品線的數據報告": "Own reporting for a product line",
    "SQL、數據視覺化工具，以及一份能展示分析過程的作品。": "SQL, data visualisation tools and a project that demonstrates your analysis process.",
    "用一個公開數據集完成一份分析作品；把過往的數據工作整理成作品集的一頁。": "Build an analysis project from a public dataset, then turn past data work into a portfolio page.",
    "入門職位常要求 SQL，補足之前面試機會會較少。": "Entry-level roles often require SQL, so interview opportunities may be limited until you build it.",
    "補足文案和社交媒體策略": "Build copywriting and social media strategy skills",
    "獨立負責一個品牌活動": "Own a brand campaign",
    "文案作品集，以及廣告投放的基本知識。": "A copywriting portfolio and basic knowledge of paid media.",
    "為一個虛構品牌做完整的社交媒體方案；參加一次校外品牌策劃比賽。": "Create a complete social media plan for a fictional brand and enter an external brand-planning competition.",
    "競爭者多，作品集的質素決定你能否突圍。": "Competition is high, so portfolio quality will determine whether you stand out.",
    "補足電商平台營運": "Build e-commerce platform operations skills",
    "管理一個網店的營運指標": "Manage an online store's operating metrics",
    "電商平台後台操作，以及轉換率分析。": "Back-office e-commerce operations and conversion-rate analysis.",
    "完成一個電商平台的免費課程；分析一個網店的產品頁並提出改善建議。": "Complete a free e-commerce course, then analyse a store's product page and propose improvements.",
    "部分職位要處理大量日常營運工作，節奏較急。": "Some roles involve a high volume of fast-paced daily operations.",
    "補足 SQL、Python 和統計": "Build SQL, Python and statistics skills",
    "獨立負責一個部門的報表": "Own reporting for a department",
    "SQL 和 Python 的實際項目經驗，以及基本統計概念。": "Hands-on SQL and Python project experience, plus core statistical concepts.",
    "每天練習 SQL 題目；用 Python 完成一個由數據清理到圖表的小項目。": "Practise SQL daily and complete a small Python project from data cleaning through visualisation.",
    "技術要求較明確，沒有作品較難證明能力。": "Technical requirements are explicit, and skills are harder to prove without a project.",
    "補足項目管理和流程分析": "Build project management and process analysis skills",
    "負責一個跨部門項目": "Own a cross-functional project",
    "項目管理方法，以及用數據說明流程改善的能力。": "Project management methods and the ability to quantify process improvements.",
    "把一次籌辦活動的經驗寫成完整的項目案例；學習一套常用的項目管理工具。": "Turn an event-organising experience into a full project case study and learn a common project management tool.",
    "工作成果不容易量化，面試時要準備具體例子。": "Outcomes can be hard to quantify, so prepare specific interview examples.",
    "補足產品和增長的基本功": "Build product and growth fundamentals",
    "初創企業營運或增長職位": "Startup operations or growth role",
    "負責一個產品功能的推出": "Own a product feature launch",
    "快速學習新工具的能力，以及處理不確定情況的經驗。": "The ability to learn tools quickly and experience handling ambiguity.",
    "參加一次初創企業活動並認識三位創辦人；用一個週末做一個小型產品實驗。": "Attend a startup event and meet three founders, then run a small product experiment over one weekend.",
    "工作範圍和穩定性較難預計，要考慮自己能否接受。": "The scope and stability are less predictable, so consider whether that suits you.",

    "模板": "Template",
    "模板 A": "Template A",
    "模板 B": "Template B",
    "下載 CV（PDF）": "Download CV (PDF)",
    "基本資料": "Contact details",
    "姓名": "Name",
    "電郵": "Email",
    "電話": "Phone",
    "LinkedIn 或作品集（可選）": "LinkedIn or portfolio (optional)",
    "學歷": "Education",
    "學校": "School",
    "學位或主修": "Degree or major",
    "新增一段經歷": "Add experience",
    "資料會自動儲存在這個瀏覽器。AI 不會虛構數字，請把「[填入數字]」換成真實數字。": "Your data is saved automatically in this browser. AI will not invent numbers; replace [add number] with real figures.",
    "CV 預覽": "CV preview",
    "每行一項，例如：協助整理社交媒體數據，每週製作報告": "One item per line, e.g. analysed social media data and produced a weekly report",
    "用 AI 改寫成成果句": "Rewrite as an impact statement with AI",
    "先寫下你做過甚麼，每行一項。": "First describe what you did, one item per line.",
    "正在改寫……": "Rewriting…",
    "刪除": "Delete",
    "職位": "Role",
    "機構": "Organisation",
    "時間": "Dates",
    "例如：2025 年 6 至 8 月": "e.g. Jun–Aug 2025",
    "你做過甚麼（每行一項）": "What you did (one item per line)",
    "原句": "Original",
    "建議": "Suggestion",
    "採用建議": "Use suggestion",
    "保留原句": "Keep original",
    "已採用建議": "Suggestion applied",
    "已保留原句": "Original kept",
    "[電郵]": "[Email]",
    "[電話]": "[Phone]",
    "[電郵]｜[電話]": "[Email] | [Phone]",
    "[你的名字]": "[Your name]",
    "[年份]": "[Year]",
    "[學位或主修]": "[Degree or major]",
    "經歷": "Experience",
    "[職位]": "[Role]",
    "[機構]": "[Organisation]",
    "[在左邊加入經歷]": "[Add experience on the left]",
    "技能": "Skills",
    "[技能]": "[Skills]",
    "即時預覽。下載時請在列印視窗選「另存為 PDF」，匯出的文字可被複製，適合 ATS 系統讀取。": "Live preview. When downloading, choose Save as PDF in the print dialog. Exported text remains selectable and ATS-readable.",

    "按你的主修、興趣和技能推薦。職位方向會連到求職網站的搜尋結果，活動會連到主辦方的頁面。清單由團隊人手核實。": "Recommendations based on your major, interests and skills. Role links open job-search results, while activities link to organisers' pages. The team verifies the list manually.",
    "篩選類型": "Filter by type",
    "全部": "All",
    "職位方向": "Role directions",
    "實習計劃": "Internships",
    "活動": "Events",
    "比賽": "Competitions",
    "這個類型暫時沒有項目。": "There are no items in this category yet.",
    "搜尋職位": "Search roles",
    "查看詳情": "View details",
    "連結由團隊核實後加入": "The link will be added after team verification",
    "連結待核實": "Link pending verification",
    "推薦原因": "Why it matches",
    "你還沒有建立資料，現在顯示所有項目。": "You have not created a profile yet, so all items are shown.",
    "入門職位方向，連到求職網站的搜尋結果": "Entry-level direction linking to job-search results",
    "[機構名稱] 暑期數據實習": "[Organisation] Summer Data Internship",
    "[主辦機構] 品牌策劃工作坊": "[Organiser] Brand Planning Workshop",
    "[主辦機構] 大學生市場策劃比賽": "[Organiser] University Marketing Plan Competition",
    "[主辦機構] 初創企業開放日": "[Organiser] Startup Open Day",
    "截止：[日期]": "Deadline: [date]",
    "日期：[日期]": "Date: [date]",
    "[日期]": "[date]",

    "戴上耳機效果最好": "Headphones work best",
    "可避免回音被誤判為說話_": "They prevent echoes being mistaken for speech_",
    "AI 面試": "AI Interview",
    "練習室": "Practice Room",
    "根據你的 CV 和目標職位，進行 5 條問題的模擬面試。每條最多追問一次。": "Take a five-question mock interview based on your CV and target role. Each question may have one follow-up.",
    "目標職位": "Target role",
    "開始": "Start",
    "[ 不用語音，改用文字作答 ]": "[ Answer by text instead of voice ]",
    "5 條": "5 questions",
    "2 條根據你的 CV、2 條行為題、1 條情境題。": "Two CV questions, two behavioural questions and one situational question.",
    "會追問": "Follow-up questions",
    "回答欠缺行動或結果時，教練會追問一次。": "The coach follows up once when an answer lacks action or results.",
    "即時字幕": "Live transcript",
    "你和教練說的每句話都會即時顯示。": "Everything you and the coach say appears live.",
    "完結即出報告": "Instant report",
    "評分、語速、口頭禪和錄音回放。": "Scores, speaking pace, filler words and recording playback.",
    "面試進行中": "Interview in progress",
    "原創角色插畫": "Original character illustration",
    "（由 S 製作 4 種狀態）": "(four states created by S)",
    "準備中": "Getting ready",
    "你的回答": "Your answer",
    "用 STAR 方法作答：情況、任務、行動、結果。": "Use STAR: situation, task, action and result.",
    "改用文字作答": "Switch to text",
    "答完了": "I'm done",
    "送出答案": "Submit answer",
    "結束面試": "End interview",
    "面試完結": "Interview complete",
    "錄音只在這個瀏覽器，離開頁面後就會消失。需要的話請先下載。": "The recording only exists in this browser and disappears when you leave the page. Download it first if needed.",
    "下載錄音": "Download recording",
    "說話中": "Speaking",
    "聆聽中": "Listening",
    "思考中": "Thinking",
    "根據 CV": "From your CV",
    "行為題": "Behavioural",
    "情境題": "Situational",
    "請先輸入你的回答。": "Enter your answer first.",
    "還未聽到你的回答。可以再說一次，或改用文字作答。": "I did not hear an answer. Try again or switch to text.",
    "這次沒有作答，所以沒有報告。": "No answers were submitted, so no report was created.",
    "重新開始": "Start again",
    "正在產生報告……": "Generating report…",
    "入門職位": "Entry-level role",
    "報告已儲存在「我的報告」。": "Your report has been saved in My Reports.",
    "查看報告": "View report",
    "再練一次": "Practise again",
    "重新評分": "Try scoring again",
    "未能使用咪高峰，已改用文字作答。": "The microphone is unavailable, so text mode is now active.",
    "這個瀏覽器不支援語音功能，建議用桌面版 Chrome；你仍然可以用文字作答。": "This browser does not support voice features. Desktop Chrome is recommended, but you can still answer by text.",
    "提示：先建立資料，題目會更貼近你的經歷。": "Tip: create your profile first for questions tailored to your experience.",
    "未能使用咪高峰。請在瀏覽器網址列允許咪高峰權限，或改用文字作答。": "The microphone is unavailable. Allow microphone access in the address bar or switch to text.",
    "請揀一段你最有代表性的經歷，講講你具體負責甚麼，結果如何。": "Choose one experience that best represents you. What were you personally responsible for, and what was the outcome?",
    "如果要用一個數字說明結果，會是甚麼？": "If you described the result with one number, what would it be?",
    "你的 CV 上哪一項技能，最能幫你勝任這個職位？可以舉一個用過它的例子嗎？": "Which skill on your CV best prepares you for this role? Give an example of when you used it.",
    "你會怎樣繼續提升這項技能？": "How would you continue developing this skill?",
    "可以講一次你在團隊中處理意見分歧的經驗嗎？": "Tell me about a time you handled a disagreement within a team.",
    "如果重來一次，你會怎樣做得更好？": "What would you do better if you could repeat it?",
    "講一次你趕不及限期的經歷，你當時怎樣處理？": "Tell me about a time you were going to miss a deadline. How did you handle it?",
    "之後你改變了甚麼做法，避免再發生？": "What did you change afterwards to prevent it happening again?",
    "講一次你收到負面意見的經驗，你怎樣回應？": "Tell me about a time you received negative feedback. How did you respond?",
    "那次意見最後帶來了甚麼改變？": "What ultimately changed as a result of that feedback?",
    "如果你負責的推廣活動第一週數據很差，你會先看哪些指標，下一步做甚麼？": "If a campaign you owned performed poorly in its first week, which metrics would you check first and what would you do next?",
    "你會怎樣向上司匯報這個情況？": "How would you report the situation to your manager?",
    "如果兩位上司同時給你緊急任務，而你只能先完成一項，你會怎樣處理？": "If two managers gave you urgent tasks at the same time and you could only complete one first, how would you handle it?",
    "你會怎樣跟另一位上司溝通？": "How would you communicate with the other manager?",

    "創業者路線 _01": "Founder Path _01",
    "公司設定與運營成本": "Company Setup & Operating Costs",
    "三個練習都用這份設定。數字只存在你的瀏覽器；不想填可以直接用示範公司。": "All three exercises use this setup. The numbers stay in your browser; use the demo company if you prefer not to enter them.",
    "使用示範公司": "Use demo company",
    "公司名稱": "Company name",
    "行業": "Industry",
    "階段": "Stage",
    "現金（HK$）": "Cash (HK$)",
    "每月收入（HK$）": "Monthly revenue (HK$)",
    "平均月薪（HK$）": "Average monthly salary (HK$)",
    "伺服器費用（每月）": "Server costs (monthly)",
    "其他營運支出（每月）": "Other operating costs (monthly)",
    "每位客戶月費（HK$）": "Monthly fee per customer (HK$)",
    "人手": "Headcount",
    "每月市場預算": "Monthly marketing budget",
    "改動會自動儲存，右邊的計算即時更新。": "Changes are saved automatically and the calculations update instantly.",
    "未來 24 個月": "Next 24 months",
    "每月支出": "Monthly spending",
    "每月淨額": "Monthly net",
    "現金可撐": "Runway",
    "12 個月後現金": "Cash after 12 months",
    "現金走勢圖": "Cash trend chart",
    "假設：每月基本增長 6%（市場預算 HK$15,000 時）、流失率 2%。數字由計算器算出，只作練習用途。": "Assumptions: 6% base monthly growth at a HK$15,000 marketing budget and 2% churn. Calculator-generated figures for practice only.",
    "練習": "Exercises",
    "三張危機卡，12 個月後看公司生存還是破產": "Three crisis cards; see whether the company survives 12 months",
    "談估值、期權池、優先清算權，看退出時實得多少": "Negotiate valuation, option pool and liquidation preference, then see exit proceeds",
    "回覆企業採購經理的預算和合規異議": "Respond to budget and compliance objections from enterprise procurement",
    "我的公司": "My company",
    "未填寫": "Not provided",
    "現在": "Now",
    "已耗盡": "Depleted",
    "已載入示範公司 LedgerLite。": "Demo company LedgerLite loaded.",

    "換一組事件": "Draw new events",
    "Black Swan 壓力測試": "Black Swan Stress Test",
    "十二個月時間線": "Twelve-month timeline",
    "公司狀態": "Company status",
    "現金（事件月初）": "Cash at start of event month",
    "每月收入": "Monthly revenue",
    "數字由計算器按你的設定和決定算出。": "Figures are calculated from your setup and decisions.",
    "12 個月預測": "12-month forecast",
    "不作調整": "No adjustment",
    "你的決定": "Your decisions",
    "現金走勢：不作調整與你的決定": "Cash trend: no adjustment vs your decisions",
    "第 12 個月現金": "Cash in month 12",
    "開始": "Start",
    "確定，看 12 個月結果": "Confirm and see the 12-month result",
    "確定，進入下一個事件": "Confirm and continue to the next event",
    "用一兩句說明你的理由": "Explain your reasoning in one or two sentences",
    "例如：先減市場預算，保留現金補聘工程師。": "e.g. Cut marketing first and preserve cash to hire an engineer.",
    "12 個月後仍然生存": "Still operating after 12 months",
    "你還未寫理由。報告會根據你的理由評分，要繼續嗎？": "You have not explained your reasoning. The report scores it—continue anyway?",
    "產生報告": "Generate report",
    "公司生存": "Company survives",
    "最後現金": "Ending cash",
    "已作決定": "Decisions made",
    "報告會根據你寫的理由，評估你的現金管理、優先次序和決定的一致性。": "The report uses your reasoning to assess cash management, priorities and decision consistency.",
    "再玩一次": "Play again",
    "正在載入劇本……": "Loading scenario…",
    "換一組事件會清除目前的決定，要繼續嗎？": "Drawing new events will clear your current decisions. Continue?",
    "已抽取一組新的事件。": "A new set of events has been drawn.",
    "首席工程師辭職，加入你的競爭對手": "Lead engineer quits to join a competitor",
    "她負責整個後端架構。新功能開發速度明顯下降，同一星期雲端供應商通知下月起加價。": "She owns the entire backend architecture. Feature development slows sharply, and the cloud provider announces a price increase starting next month.",
    "每位客戶月費": "Monthly fee per customer",
    "過橋融資": "Bridge financing",
    "不融資": "No financing",
    "向天使投資者借 30 萬": "Borrow HK$300k from an angel investor",
    "最大客戶延遲付款 90 日": "Largest customer delays payment by 90 days",
    "佔你收入三成的客戶表示內部審批延誤，未來三個月的帳單會延後支付。": "A customer representing 30% of revenue reports an internal approval delay and will pay the next three months of invoices late.",
    "其他營運支出": "Other operating costs",
    "申請 20 萬短期貸款": "Apply for a HK$200k short-term loan",
    "主要對手宣布減價 40%": "Main competitor announces a 40% price cut",
    "幾位客戶開始詢問你會否跟隨減價，銷售團隊擔心續約率下降。": "Several customers ask whether you will match the cut, and the sales team fears lower renewals.",
    "系統故障 48 小時": "48-hour system outage",
    "資料庫升級出錯，所有客戶兩日無法登入，需要賠償服務費並加強監控。": "A database upgrade fails, locking every customer out for two days and requiring service credits and stronger monitoring.",
    "每月伺服器及監控費用": "Monthly server and monitoring costs",
    "大客戶要求新的資料保安認證": "Major customer requires a new security certification",
    "兩個潛在企業客戶要求你在三個月內完成第三方保安審計，否則不會簽約。": "Two enterprise prospects require an independent security audit within three months or they will not sign.",

    "Term Sheet 談判": "Term Sheet Negotiation",
    "種子輪談判": "Seed-round negotiation",
    "談判": "Negotiation",
    "投資者": "Investor",
    "投資者（角色）": "Investor (role)",
    "給投資者的回覆（可選，一兩句說明你的考慮）": "Reply to the investor (optional; explain your thinking in one or two sentences)",
    "例如：我們接受 600 萬估值，但期權池希望在投後設立，因為……": "e.g. We accept the HK$6m valuation, but want the option pool created post-money because…",
    "投資者表示會退出談判。你可以改變選擇，或者接受沒有交易的結果並完成練習。": "The investor says they will walk away. Change your choice or accept a no-deal outcome and finish the exercise.",
    "上一輪": "Previous round",
    "下一輪": "Next round",
    "計算結果": "Calculated results",
    "持股比例": "Ownership",
    "由計算器計算": "Calculated by the model",
    "退出時創辦人實得": "Founders' proceeds at exit",
    "A 輪、B 輪後": "After Series A and B",
    "接受": "Accept",
    "還價": "Counter",
    "拒絕": "Reject",
    "完成談判，產生報告": "Finish negotiation and generate report",
    "創辦人": "Founders",
    "期權池": "Option pool",
    "種子輪": "Seed round",
    "A 輪": "Series A",
    "B 輪": "Series B",
    "沒有交易，股權維持不變：創辦人 100%。": "No deal. Ownership remains unchanged: founders 100%.",
    "種子輪後": "After seed round",
    "B 輪後": "After Series B",
    "投前估值": "Pre-money valuation",
    "接受 600 萬": "Accept HK$6m",
    "還價 800 萬": "Counter at HK$8m",
    "接受投前 15%": "Accept 15% pre-money",
    "還價投後 10%": "Counter with 10% post-money",
    "清算優先權": "Liquidation preference",
    "投資者董事席位": "Investor board seats",
    "接受 2 席": "Accept 2 seats",
    "還價 1 席＋1 位獨立董事": "Counter with 1 seat + 1 independent director",
    "我們很看好你們的團隊。投前估值 600 萬，我們投資 200 萬。另外，交易前要把期權池擴大到 15%。": "We are impressed by your team. We propose a HK$6m pre-money valuation and will invest HK$2m. The option pool must also expand to 15% before the deal.",
    "為了保障我們，清算優先權要 2 倍並可參與分配。董事會方面，我們要兩個席位。": "For our protection, we require a 2x participating liquidation preference and two board seats.",
    "假設：種子輪投資 HK$ 200 萬；A 輪投前 2,400 萬、投資 600 萬、期權池 10%；B 輪投前 8,000 萬、投資 2,000 萬；後續輪次均為 1x non-participating。": "Assumptions: HK$2m seed investment; Series A at HK$24m pre-money with a HK$6m investment and 10% option pool; Series B at HK$80m pre-money with a HK$20m investment; all later rounds use 1x non-participating preference.",

    "電郵練習": "Email practice",
    "電郵往來": "Email thread",
    "對方的下一封電郵，會按你的回覆內容而改變。": "The next email changes according to your reply.",
    "你的回覆": "Your reply",
    "Grace 你好，": "Hi Grace,",
    "檢查": "Checks",
    "傳送回覆": "Send reply",
    "有具體數字": "Includes a specific number",
    "提出下一步和時間": "Proposes a next step and timing",
    "已回覆": "Replied",
    "待回覆": "Awaiting reply",
    "未收到": "Not received",
    "回覆太短了，最少寫 20 字。": "Your reply is too short. Write at least 20 characters.",
    "等待對方回覆……": "Waiting for a reply…",
    "電郵往來完成": "Email thread complete",
    "B2B 電郵練習：向物流公司銷售排班系統": "B2B Email Practice: Selling a Scheduling System to a Logistics Company",
    "Grace Lam，採購經理": "Grace Lam, Procurement Manager",
    "Re: 排班系統建議書": "Re: Scheduling system proposal",
    "謝謝你的建議書。坦白說，今年的 IT 預算已經凍結，而且我們現在用 Excel 排班也沒有太大問題。你可以說明為甚麼我們需要在這個時候轉用新系統嗎？": "Thank you for the proposal. To be frank, this year's IT budget is frozen and our current Excel scheduling works reasonably well. Why should we switch systems now?",
    "兩星期後……": "Two weeks later…",
    "Re: 排班系統建議書（資料保安）": "Re: Scheduling system proposal (data security)",
    "我們的法務部想知道員工資料存放在哪裡、誰可以存取，以及你們有沒有第三方保安認證。在收到答覆前，我們不能安排試用。": "Our legal team needs to know where employee data is stored, who can access it and whether you hold third-party security certifications. We cannot arrange a trial until these questions are answered.",
    "我們內部討論過，仍然看不到轉用新系統的實際好處。另外法務部想知道員工資料存放在哪裡、誰可以存取，以及你們有沒有第三方保安認證。如果兩方面都沒有清楚答案，我們這一季不會再跟進。": "We discussed this internally and still cannot see the practical benefit of switching systems. Legal also needs to know where employee data is stored, who can access it and whether you hold third-party security certifications. Without clear answers on both points, we will not proceed this quarter.",

    "每次練習的評分報告": "Scores and feedback from every practice session",
    "報告只儲存在這個瀏覽器，最多保留 30 份。": "Reports are stored only in this browser, up to 30 at a time.",
    "報告列表": "Report list",
    "破產月份": "Bankruptcy month",
    "沒有破產": "No bankruptcy",
    "有盈利": "Profitable",
    "種子輪後創辦人持股": "Founder ownership after seed",
    "B 輪後創辦人持股": "Founder ownership after Series B",
    "退出 3,000 萬時創辦人實得": "Founders' proceeds at HK$30m exit",
    "退出 6,000 萬時創辦人實得": "Founders' proceeds at HK$60m exit",
    "退出 2 億時創辦人實得": "Founders' proceeds at HK$200m exit",
    "退出 6,000 萬時種子投資者實得": "Seed investor proceeds at HK$60m exit",
    "投資者退出談判": "Investor walked away",
    "是": "Yes",
    "否": "No",
    "回覆電郵": "Email replies",
    "平均字數": "Average length",
    "有提出下一步的回覆": "Replies with a next step",
    "有具體數字的回覆": "Replies with specific numbers",
    "第一封回覆有量化 ROI": "First reply quantified ROI",
    "有": "Yes",
    "沒有": "No",
    "語速（每分鐘字數）": "Speaking pace (characters per minute)",
    "口頭禪（即係、跟住等）": "Filler words",
    "完成題目": "Questions completed",
    "面試時間": "Interview duration",
    "再試一次": "Try again",
    "前往下一站": "Go to the next station",
    "下載報告（PDF）": "Download report (PDF)",
    "確定刪除這份報告？": "Delete this report?",
    "伺服器未設定 AI 服務，分數按簡單規則估算": "AI is not configured on the server; scores use simple rules",
    "示範評分（未連接 AI）": "Demo score (AI not connected)",
    "分數": "Scores",
    "逐項回饋": "Detailed feedback",
    "（這一項的引文無法在你的原文中核實，已經移除。）": "(The quotation for this item could not be verified against your original words and was removed.)",
    "改寫示範": "Rewrite example",
    "方括號內的數字需要換成真實資料。": "Replace numbers in square brackets with real data.",
    "計算結果與指標": "Calculated results and metrics",
    "這些數字由程式計算，不是 AI 估算。": "These figures are calculated by code, not estimated by AI.",
    "還沒有報告。完成任何一個練習後，報告會出現在這裡。": "No reports yet. Complete any exercise and its report will appear here.",
    "練習面試": "Practise an interview",
    "玩 Black Swan": "Play Black Swan",
    "（沒有相關內容）": "(No relevant content)",

    "STAR 完整度": "STAR completeness",
    "與職位相關": "Relevance to the role",
    "具體成果": "Specific outcomes",
    "表達清晰": "Clarity",
    "處理事件的根本原因": "Addresses the root cause",
    "考慮滯後效應": "Accounts for delayed effects",
    "理由與數字一致": "Reasoning matches the numbers",
    "理解條款的長遠影響": "Understands long-term impact of terms",
    "取捨有重點": "Prioritises trade-offs",
    "控制權意識": "Awareness of control",
    "處理預算異議": "Handles budget objections",
    "量化 ROI": "Quantifies ROI",
    "處理合規問題": "Handles compliance concerns",
    "語氣專業而具同理心": "Professional, empathetic tone",
    "語氣與篇幅": "Tone and length",
    "提出清晰下一步": "Proposes a clear next step",

    "處理中……": "Working…",
    "無法連接伺服器。請檢查網絡，然後再試一次。": "Could not connect to the server. Check your network and try again.",
    "伺服器暫時未能處理，請稍後再試。": "The server cannot process this request right now. Try again later.",
    "確定要清除這個瀏覽器裡的所有資料和報告嗎？這個動作不能復原。": "Clear all data and reports from this browser? This cannot be undone.",
    "已清除所有資料。": "All data has been cleared.",
    "不支援這個任務。": "This task is not supported.",
    "使用次數已達上限，請一小時後再試。": "Usage limit reached. Try again in one hour.",
    "暫時未能處理，請稍後再試。": "Unable to process this right now. Try again later.",
    "評分次數已達上限，請一小時後再試。": "Scoring limit reached. Try again in one hour.",
    "暫時未能產生報告。請按「重新評分」再試一次。": "Unable to generate the report right now. Select Try scoring again.",
    "（示範評分，尚未連接 AI）整體表現中等，可以按各項建議改善。": "(Demo score — AI is not connected.) A solid start; use the suggestions below to improve your next attempt."
  };

  const PATTERNS = [
    [/^(\d+) 個英文詞$/, (_, n) => `${n} English words`],
    [/^(\d+) 個詞$/, (_, n) => `${n} words`],
    [/^(\d+) 詞\/分鐘$/, (_, n) => `${n} words/min`],
    [/^(.+)：預設追問$/, (_, kind) => `${translate(kind)}: Scripted follow-up`],
    [/^(.+)：(AI 追問|後備追問)$/, (_, kind, followUp) => `${translate(kind)}: ${translate(followUp)}`],
    [/^英文面試（示範）：(.+)$/, (_, role) => `English Interview (Demo): ${translate(role)}`],
    [/^英文面試：(.+)$/, (_, role) => `English Interview: ${translate(role)}`],
    [/^對話面試：(.+)$/, (_, role) => `Conversational Interview: ${translate(role)}`],
    [/^(.+) 回答已保留在本頁，可重試評分。$/, (_, message) => `${translate(message)} Your answers are preserved on this page. Retry scoring when ready.`],
    [/^[✓○]\s+(.+)$/, (whole, rest) => whole.slice(0, 2) + translate(rest)],
    [/^「(.+)」$/, (_, inner) => `“${translateExact(inner)}”`],
    [/^第 (\d+) \/ (\d+) 封$/, (_, a, b) => `Email ${a} of ${b}`],
    [/^第 (\d+) \/ (\d+) 輪$/, (_, a, b) => `Round ${a} of ${b}`],
    [/^事件 (\d+) \/ (\d+)$/, (_, a, b) => `Event ${a} of ${b}`],
    [/^第 (\d+) 題$/, (_, n) => `Question ${n}`],
    [/^第 (\d+) 個月・突發事件$/, (_, n) => `Month ${n} · Unexpected event`],
    [/^公司狀態（第 (\d+) 個月）$/, (_, n) => `Company status (month ${n})`],
    [/^第 (\d+) 個月現金耗盡$/, (_, n) => `Cash runs out in month ${n}`],
    [/^第 (\d+) 個月破產$/, (_, n) => `Bankrupt in month ${n}`],
    [/^12 個月後，(.+) 仍然營運$/, (_, name) => `${name} is still operating after 12 months`],
    [/^(.+) 的現金在第 (\d+) 個月耗盡$/, (_, name, n) => `${name} runs out of cash in month ${n}`],
    [/^(\d+) 人$/, (_, n) => `${n} people`],
    [/^(\d+) 個月$/, (_, n) => `${n} months`],
    [/^(\d+)月$/, (_, n) => `Month ${n}`],
    [/^第 (\d+) 月$/, (_, n) => `Month ${n}`],
    [/^約 (\d+) 個月$/, (_, n) => `About ${n} months`],
    [/^超過 (\d+) 個月$/, (_, n) => `More than ${n} months`],
    [/^(\d+) 個$/, (_, n) => `${n}`],
    [/^(\d+) 字$/, (_, n) => `${n} characters`],
    [/^(\d+) 次$/, (_, n) => `${n} times`],
    [/^(\d+) 條$/, (_, n) => `${n}`],
    [/^(\d+) 封$/, (_, n) => `${n}`],
    [/^(\d+) 席$/, (_, n) => `${n} seats`],
    [/^(\d+) 分 (\d+) 秒$/, (_, m, s) => `${m} min ${s} sec`],
    [/^(\d+) 字（建議 80 至 400）$/, (_, n) => `${n} characters (80–400 recommended)`],
    [/^寄件人：(.+)　收件人：你（(.+)）$/, (_, from, company) => `From: ${translateExact(from)}  To: you (${company})`],
    [/^B2B 電郵：(.+)$/, (_, name) => `B2B Email: ${name}`],
    [/^AI 面試：(.+)$/, (_, role) => `AI Interview: ${role}`],
    [/^經歷 (\d+)$/, (_, n) => `Experience ${n}`],
    [/^核實：(.+)$/, (_, date) => `Verified: ${translateExact(date)}`],
    [/^Verified: (\[日期\])$/, (_, date) => `Verified: ${translateExact(date)}`],
    [/^根據：(.+)$/, (_, basis) => `Based on: ${translateComposite(basis)}`],
    [/^退出 (.+)$/, (_, value) => `Exit at ${wanToEnglish(value)}`],
    [/^([\d,]+)萬$/, (_, value) => `HK$ ${Number(value.replace(/,/g, '')) * 10000}`.replace(/\d+$/, (n) => Number(n).toLocaleString('en-US'))],
    [/^HK\$ ([\d,]+) 萬$/, (_, value) => `HK$ ${(Number(value.replace(/,/g, '')) * 10000).toLocaleString('en-US')}`],
    [/^HK\$ ([\d,]+) 萬（(\d+)%）$/, (_, value, pct) => `HK$ ${(Number(value.replace(/,/g, '')) * 10000).toLocaleString('en-US')} (${pct}%)`],
    [/^比全部接受多 (.+)$/, (_, value) => `${value} more than accepting all terms`],
    [/^注意：有 (\d+) 項引文無法核實，已經移除。$/, (_, n) => `Note: ${n} unverified quotation${n === '1' ? '' : 's'} removed.`],
    [/^你回覆了 (\d+) 封電郵，平均 (\d+) 字。報告會評估你怎樣回應異議、說明 ROI、語氣和下一步。$/, (_, n, avg) => `You replied to ${n} emails, averaging ${avg} characters. The report assesses objection handling, ROI, tone and next steps.`],
    [/^路徑 ([ABC])$/, (_, letter) => `Path ${letter}`],
    [/^(.+)＋(.+)$/, (_, left, right) => `${translateExact(left)} + ${translateExact(right)}`],
    [/^Your profile includes (.+), which aligns with this role\.$/, (_, labels) => `Your profile includes ${translateComposite(labels)}, which aligns with this role.`],
    [/^(創業者|畢業生)・(.+)$/, (_, route, date) => `${translateExact(route)} · ${date}`],
    [/^(.+)：(\d+) \/ 5$/, (_, label, score) => `${translateExact(label)}: ${score} / 5`],
    [/^(.+)｜我的報告$/, (_, title) => `${title} | My Reports`],
    [/^(.+)｜\[平台名稱\]$/, (_, title) => `${translateExact(title)} | [Platform Name]`]
  ];

  // 第 2 版：其他檔案可以在 i18n.js 之前用 window.TPI18nExtra.push({ text: {...}, patterns: [...] }) 加入翻譯，
  // 新增內容的翻譯放在 i18n-v2-grad.js 和 i18n-v2-startup.js，不用改動這個檔案。
  (window.TPI18nExtra || []).forEach((ext) => {
    Object.assign(TEXT, ext.text || {});
    PATTERNS.unshift(...(ext.patterns || []));
  });
  PATTERNS.push([/^(.+)｜2PP Helper$/, (_, title) => `${translateExact(title)} | 2PP Helper`]);

  function wanToEnglish(value) {
    const match = String(value).match(/^HK\$ ([\d,]+) 萬$/);
    return match ? `HK$ ${(Number(match[1].replace(/,/g, '')) * 10000).toLocaleString('en-US')}` : value;
  }

  function translateComposite(value) {
    return String(value).split(/([、；，,])/).map((part) => {
      if (part === '、' || part === '，' || part === ',') return ', ';
      if (part === '；') return '; ';
      return translateExact(part.trim());
    }).join('');
  }

  const ATTRS = ['aria-label', 'title', 'placeholder'];
  const originalText = new WeakMap();
  const originalAttrs = new WeakMap();
  const sourceTitle = document.title;
  let lang = readLanguage();
  let observer = null;

  function readLanguage() {
    try {
      const saved = localStorage.getItem('tp-lang');
      if (saved === 'en' || saved === 'zh-HK') return saved;
    } catch (e) { /* storage unavailable */ }
    return 'zh-HK';
  }

  function translateExact(value) {
    return Object.prototype.hasOwnProperty.call(TEXT, value) ? TEXT[value] : value;
  }

  function translate(value) {
    if (lang !== 'en' || typeof value !== 'string' || value === '') return value;
    const exact = translateExact(value);
    if (exact !== value) return exact;
    for (const [pattern, replacer] of PATTERNS) {
      if (pattern.test(value)) return value.replace(pattern, replacer);
    }
    return value;
  }

  function translatePreservingSpace(value) {
    const match = String(value).match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match || !match[2]) return value;
    return match[1] + translate(match[2]) + match[3];
  }

  function shouldSkip(node) {
    const parent = node.parentElement;
    return !parent || !!parent.closest('script,style,noscript,code,pre,[translate="no"]');
  }

  function updateTextNode(node, preserveOriginal) {
    if (shouldSkip(node)) return;
    const current = node.nodeValue || '';
    let original = originalText.get(node);
    if (original === undefined) {
      original = current;
      originalText.set(node, original);
    } else if (!preserveOriginal) {
      const expected = lang === 'en' ? translatePreservingSpace(original) : original;
      if (current !== expected && current !== original) {
        original = current;
        originalText.set(node, original);
      }
    }
    const next = lang === 'en' ? translatePreservingSpace(original) : original;
    if (current !== next) node.nodeValue = next;
  }

  function updateElement(element, preserveOriginal) {
    let saved = originalAttrs.get(element);
    if (!saved) {
      saved = {};
      originalAttrs.set(element, saved);
    }
    for (const attr of ATTRS) {
      if (!element.hasAttribute(attr)) continue;
      const current = element.getAttribute(attr) || '';
      if (!(attr in saved)) saved[attr] = current;
      else if (!preserveOriginal) {
        const expected = lang === 'en' ? translate(saved[attr]) : saved[attr];
        if (current !== expected && current !== saved[attr]) saved[attr] = current;
      }
      const next = lang === 'en' ? translate(saved[attr]) : saved[attr];
      if (current !== next) element.setAttribute(attr, next);
    }
  }

  function translateTree(root, preserveOriginal) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      updateTextNode(root, preserveOriginal);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) updateElement(root, preserveOriginal);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) updateTextNode(node, preserveOriginal);
      else updateElement(node, preserveOriginal);
    }
  }

  function updateSwitch() {
    document.documentElement.lang = lang;
    document.body.dataset.lang = lang;
    document.querySelectorAll('[data-language-switch] [data-lang]').forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.lang === lang ? 'true' : 'false');
    });
  }

  function observe() {
    if (!observer) {
      observer = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === 'characterData') updateTextNode(record.target, false);
          record.addedNodes.forEach((node) => translateTree(node, false));
          if (record.type === 'attributes') updateElement(record.target, false);
        }
      });
    }
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  function setLanguage(next) {
    if (next !== 'en' && next !== 'zh-HK') return;
    lang = next;
    try { localStorage.setItem('tp-lang', lang); } catch (e) { /* storage unavailable */ }
    document.cookie = 'tp_lang=' + encodeURIComponent(lang) + ';path=/;max-age=31536000;samesite=lax';
    if (observer) observer.disconnect();
    updateSwitch();
    translateTree(document.body, true);
    document.title = lang === 'en' ? translate(sourceTitle) : sourceTitle;
    observe();
    document.dispatchEvent(new CustomEvent('tp:languagechange', { detail: { language: lang } }));
  }

  window.TPI18n = {
    language: () => lang,
    t: (value) => lang === 'en' ? translate(String(value)) : value,
    setLanguage
  };

  updateSwitch();
  translateTree(document.body, false);
  document.title = lang === 'en' ? translate(sourceTitle) : sourceTitle;
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-language-switch] [data-lang]');
    if (button) setLanguage(button.dataset.lang);
  });
  observe();
})();
