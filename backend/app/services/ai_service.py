import httpx
from app.config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL

SYSTEM_PROMPT = """你是一位智慧的修行导师，精通佛道经典和心性修养。用户会提供最近一段时间的修行记录（包括日记、心情、修行时长等），请你根据这些数据，写一段150-300字的"修行寄语"。

要求：
- 语言优美，带有古典中文的韵味但不晦涩
- 结合用户实际的修行情况，给予有针对性的鼓励和指引
- 可以引用一句相关的佛道经典
- 语气温暖而坚定，如师长般的关怀
- 不要空洞的套话，要有具体的观察和建议"""


async def generate_cultivation_message(
    practices: list[dict],
    total_count: int,
    moods: dict,
    period_start: str,
    period_end: str,
) -> str:
    if total_count == 0:
        return _fallback_template(total_count, moods, period_start, period_end)

    practice_summary = "\n".join([
        f"- {p['date']}: {p['title'] or '无标题'} | 心情：{p['mood'] or '未记录'} | 时长：{p['duration_minutes']}分钟\n  {p['body'][:200]}"
        for p in practices
    ])

    user_message = f"""时间范围：{period_start} 至 {period_end}
修行次数：{total_count} 次
心情分布：{moods or '未记录'}

修行日记摘要：
{practice_summary}

请根据以上修行记录，写一段修行寄语。"""

    if not ANTHROPIC_API_KEY:
        return _fallback_template(total_count, moods, period_start, period_end)

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": ANTHROPIC_MODEL,
                    "max_tokens": 600,
                    "system": SYSTEM_PROMPT,
                    "messages": [{"role": "user", "content": user_message}],
                },
            )
            if response.status_code == 200:
                data = response.json()
                return data["content"][0]["text"]
            else:
                return _fallback_template(total_count, moods, period_start, period_end)
    except Exception:
        return _fallback_template(total_count, moods, period_start, period_end)


def _fallback_template(total_count: int, moods: dict, period_start: str, period_end: str) -> str:
    dominant_mood = max(moods, key=moods.get) if moods else "平和"
    mood_names = {"calm": "平静", "energized": "精力充沛", "scattered": "散乱", "peaceful": "安宁", "tired": "疲惫"}
    mood_cn = mood_names.get(dominant_mood, dominant_mood)

    templates = [
        f"过去这段时间（{period_start} 至 {period_end}），你共修习了 {total_count} 次。你的主要心境是「{mood_cn}」。\n\n修行不在多，贵在持之以恒。每一次静坐、每一次觉察，都是在心田播下觉悟的种子。{mood_cn}的状态本身即是修行的镜子，映照出你内在的真实。\n\n《道德经》云：「为学日益，为道日损。」修行的路上，不在于积累多少知识，而在于放下多少执着。请继续安住于当下，以平常心观照每一个念头。",
        f"在 {period_start} 到 {period_end} 这段时间里，你完成了 {total_count} 次修行记录，心境以「{mood_cn}」为主。\n\n修行的本质是认识自己。每一篇日记都是一面明镜，照见内心的波澜与宁静。不必追求完美的修行状态，{'散乱时知道散乱' if dominant_mood == 'scattered' else '平静时知道平静'}，这便是正念的力量。\n\n六祖惠能说：「本来无一物，何处惹尘埃。」愿你在日常中保持这份觉知，不为外境所转。",
        f"回望 {period_start} 至 {period_end}，{total_count} 次修行，{mood_cn}常伴。\n\n修行如登山，有缓坡也有陡崖。重要的是脚步不停，心念不退。你已经在路上，这本身就值得赞叹。\n\n庄子曰：「安时而处顺，哀乐不能入也。」愿你以安时处顺之心，面对修行中的一切起伏。",
    ]

    idx = total_count % len(templates)
    return templates[idx]
