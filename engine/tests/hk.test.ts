import { describe, expect, it } from "vitest";
import { toHK } from "../hk";

describe("簡轉繁（toHK）", () => {
  it("簡體文字轉成香港繁體，詞組按上下文處理", () => {
    expect(toHK("这个软件的质量很好，头发，干扰，皇后")).toBe("這個軟件的質量很好，頭髮，干擾，皇后");
  });
  it("已經是繁體的文字保持不變（不會把「干擾」變成「幹擾」）", () => {
    const t = "這個軟件的質素很好，干擾，一公里，只有";
    expect(toHK(t)).toBe(t);
  });
  it("繁體中夾雜個別簡體字：只修正簡體字", () => {
    expect(toHK("這個系統会幫你減少干擾，一公里後")).toBe("這個系統會幫你減少干擾，一公里後");
  });
  it("非字串或空字串原樣返回", () => {
    expect(toHK("")).toBe("");
    expect(toHK("ROI 12%")).toBe("ROI 12%");
  });
});
