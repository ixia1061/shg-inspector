/**
 * 점검 사진 하단에 관리번호·일시를 새긴다 (반투명 검정 띠 + 흰 글씨).
 * 디코딩할 수 없는 형식(HEIC 미지원 브라우저 등)이면 원본을 그대로 반환한다.
 */
export async function watermarkImage(file: File, lines: string[]): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas context 없음");

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const fontSize = Math.max(18, Math.round(canvas.width * 0.04));
    const lineHeight = Math.round(fontSize * 1.35);
    const padding = Math.round(fontSize * 0.6);
    const bandHeight = lineHeight * lines.length + padding * 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    lines.forEach((line, i) => {
      ctx.fillText(line, canvas.width / 2, canvas.height - bandHeight + padding + i * lineHeight);
    });

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    if (!blob) throw new Error("toBlob 실패");

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}-stamped.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** 워터마크용 현재 일시 문자열 (예: 2026-07-17 14:30) */
export function formatStampNow(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
