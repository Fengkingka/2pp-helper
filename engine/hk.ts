/**
 * 簡轉繁（香港字形），獨立打包成 site/assets/js/opencc-hk.js，只在會顯示 AI 文字的頁面載入。
 *
 * 直接把整段繁體文字再轉一次會出錯（例如「干擾」變成「幹擾」），因為有些字同時是簡體和繁體。
 * 所以這裡逐字合併：
 *  - 只屬簡體的字（例如「这」「发」）一定轉換，並沿用詞組字典的結果（「头发」→「頭髮」）；
 *  - 簡繁共用的字（例如「干」「里」「后」）只在整段文字以簡體為主時才轉換。
 * 只轉字形；詞彙（例如「默認→預設」）要靠 prompt 要求。
 */
import { ConverterFactory } from "opencc-js/core";
import fromCn from "opencc-js/from/cn";
import toHk from "opencc-js/to/hk";
import STCharacters from "opencc-js/dict/STCharacters";

const convert = ConverterFactory(fromCn as never, toHk as never);

// 簡繁共用、不可單憑字形判斷的常見字
const AMBIGUOUS = new Set(
  Array.from("干里后只系面台云冲丑范松谷表准志游余注制于几了么借出卷叶回困团家尽布帘并当征恶才采斗板汇获秋签须叹咸划折升伙仆曲朴栗梁沈淀涂症纤舍苏术向吁御郁愿岳扎占折致种周朱庄姜姹")
);

const simplifiedOnly = new Set<string>();
for (const pair of String(STCharacters).split("|")) {
  const [s, t] = pair.split(" ");
  if (s && t && s !== t && !AMBIGUOUS.has(s)) simplifiedOnly.add(s);
}

export function toHK(text: string): string {
  if (typeof text !== "string" || text === "") return text;
  const src = Array.from(text);
  const han = src.filter((c) => /\p{Script=Han}/u.test(c)).length;
  const simp = src.filter((c) => simplifiedOnly.has(c)).length;
  if (simp === 0) return text;
  const mostlySimplified = han > 0 && simp / han >= 0.15;
  const out = Array.from(convert(text));
  if (out.length !== src.length) return mostlySimplified ? out.join("") : text;
  return src.map((c, i) => (simplifiedOnly.has(c) || (mostlySimplified && AMBIGUOUS.has(c)) ? out[i] : c)).join("");
}
