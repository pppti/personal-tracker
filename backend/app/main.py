from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import CORS_ORIGINS
from app.database import init_db, async_session
from app.routers import auth, contents, practices, lots, white_noise, messages


async def seed_if_empty():
    from sqlalchemy import select
    from app.models.lot import Lot
    from app.models.white_noise import WhiteNoiseTrack

    async with async_session() as db:
        r = await db.execute(select(Lot).limit(1))
        if r.scalar_one_or_none():
            return

        lots_data = [
            {"number": 1, "title": "应无所住", "body": "应无所住而生其心。", "explanation": "心不应执著于任何事物，在无所执著中生出清净心。", "source": "《金刚经》", "category": "buddhist"},
            {"number": 2, "title": "凡所有相", "body": "凡所有相，皆是虚妄。若见诸相非相，则见如来。", "explanation": "一切表象都是虚幻的，不要被表面的得失迷惑。", "source": "《金刚经》", "category": "buddhist"},
            {"number": 3, "title": "过去心不可得", "body": "过去心不可得，现在心不可得，未来心不可得。", "explanation": "三心皆不可得，安住于当下即是修行。", "source": "《金刚经》", "category": "buddhist"},
            {"number": 4, "title": "色即是空", "body": "色不异空，空不异色，色即是空，空即是色。", "explanation": "物质与空性本是一体，在尘世中保持内心的空明。", "source": "《心经》", "category": "buddhist"},
            {"number": 5, "title": "心无挂碍", "body": "心无挂碍，无挂碍故，无有恐怖，远离颠倒梦想，究竟涅槃。", "explanation": "当心没有挂碍时，就不会有恐惧。", "source": "《心经》", "category": "buddhist"},
            {"number": 6, "title": "照见五蕴皆空", "body": "观自在菩萨，行深般若波罗蜜多时，照见五蕴皆空，度一切苦厄。", "explanation": "深入观照，会发现一切身心现象都是空的。", "source": "《心经》", "category": "buddhist"},
            {"number": 7, "title": "诸法无我", "body": "诸法无我，诸行无常，涅槃寂静。", "explanation": "一切事物都在变化中，接受变化，随缘而行。", "source": "三法印", "category": "buddhist"},
            {"number": 8, "title": "一念净心", "body": "一念净心，花开世界。", "explanation": "当心中生起一念清净，整个世界都会为你盛开。", "source": "禅宗语录", "category": "buddhist"},
            {"number": 9, "title": "平常心是道", "body": "平常心是道。", "explanation": "日常之中自有真道，保持平常心面对一切。", "source": "赵州禅师", "category": "buddhist"},
            {"number": 10, "title": "放下", "body": "放下屠刀，立地成佛。", "explanation": "一念放下，万般自在。此刻你准备好放下了吗？", "source": "佛经", "category": "buddhist"},
            {"number": 11, "title": "万法唯心", "body": "三界唯心，万法唯识。", "explanation": "一切境界都由心识变现。改变内心，就能改变你的世界。", "source": "《华严经》", "category": "buddhist"},
            {"number": 12, "title": "慈悲", "body": "无缘大慈，同体大悲。", "explanation": "以慈悲心对待他人，也是在善待自己。", "source": "大乘佛教", "category": "buddhist"},
            {"number": 13, "title": "自性清净", "body": "何期自性，本自清净；何期自性，本不生灭。", "explanation": "你的本性原本清净，无需向外求，回归自性即可。", "source": "《六祖坛经》", "category": "buddhist"},
            {"number": 14, "title": "菩提本无树", "body": "菩提本无树，明镜亦非台，本来无一物，何处惹尘埃。", "explanation": "心性本来空寂，认识到本无一物，便不再被尘埃所染。", "source": "《六祖坛经》", "category": "buddhist"},
            {"number": 15, "title": "非风非幡", "body": "不是风动，不是幡动，仁者心动。", "explanation": "外境并不动摇，动摇的是你的心。", "source": "《六祖坛经》", "category": "buddhist"},
            {"number": 16, "title": "无念为宗", "body": "无念为宗，无相为体，无住为本。", "explanation": "以无念为宗旨，不执著于任何念头。", "source": "《六祖坛经》", "category": "buddhist"},
            {"number": 17, "title": "烦恼即菩提", "body": "烦恼即菩提。", "explanation": "烦恼本身就是觉悟的材料。在烦恼中观察，在困境中成长。", "source": "《六祖坛经》", "category": "buddhist"},
            {"number": 18, "title": "如是观", "body": "一切有为法，如梦幻泡影，如露亦如电，应作如是观。", "explanation": "世间一切如梦幻般短暂，不必执着于得失。", "source": "《金刚经》", "category": "buddhist"},
            {"number": 19, "title": "见山还是山", "body": "见山是山，见山不是山，见山还是山。", "explanation": "修行的三个阶段：从认知，到怀疑，再到回归本真。", "source": "青原惟信禅师", "category": "buddhist"},
            {"number": 20, "title": "吃茶去", "body": "吃茶去。", "explanation": "修行不在玄谈，而在日常的点滴实践。", "source": "赵州禅师", "category": "buddhist"},
            {"number": 21, "title": "心安即归处", "body": "身心安处为吾土。", "explanation": "此心安处便是故乡，安宁不在远方，就在当下。", "source": "白居易", "category": "buddhist"},
            {"number": 22, "title": "山中无老死", "body": "春有百花秋有月，夏有凉风冬有雪。若无闲事挂心头，便是人间好时节。", "explanation": "四季各有美好，只要心中不挂闲事，每一天都是好日子。", "source": "无门慧开禅师", "category": "buddhist"},
            {"number": 30, "title": "道可道非常道", "body": "道可道，非常道；名可名，非常名。", "explanation": "真正的道无法用言语描述，用心去体会。", "source": "《道德经》第一章", "category": "daoist"},
            {"number": 31, "title": "上善若水", "body": "上善若水。水善利万物而不争，处众人之所恶，故几于道。", "explanation": "学习水的柔韧与处下，以柔克刚。", "source": "《道德经》第八章", "category": "daoist"},
            {"number": 32, "title": "致虚极守静笃", "body": "致虚极，守静笃。万物并作，吾以观复。", "explanation": "让心达到虚静的极致，静能生慧，此刻正宜静坐。", "source": "《道德经》第十六章", "category": "daoist"},
            {"number": 33, "title": "曲则全", "body": "曲则全，枉则直，洼则盈，敝则新，少则得，多则惑。", "explanation": "有时候退一步，反而能看到更广阔的前路。", "source": "《道德经》第二十二章", "category": "daoist"},
            {"number": 34, "title": "知足者富", "body": "知足者富。强行者有志。不失其所者久。", "explanation": "知道满足的人才是真正富有，感恩当下。", "source": "《道德经》第三十三章", "category": "daoist"},
            {"number": 35, "title": "大道至简", "body": "大器晚成，大音希声，大象无形。", "explanation": "真正伟大的事物往往简朴而不张扬，厚积薄发。", "source": "《道德经》第四十一章", "category": "daoist"},
            {"number": 36, "title": "为道日损", "body": "为学日益，为道日损。损之又损，以至于无为。", "explanation": "修道是减法，不断减去心中的杂念和执著。", "source": "《道德经》第四十八章", "category": "daoist"},
            {"number": 37, "title": "祸福相依", "body": "祸兮福之所倚，福兮祸之所伏。", "explanation": "祸福相互转化，保持中道，安时处顺。", "source": "《道德经》第五十八章", "category": "daoist"},
            {"number": 38, "title": "天下难事", "body": "天下难事必作于易，天下大事必作于细。", "explanation": "所有难事从容易处开始，从当下这一步开始吧。", "source": "《道德经》第六十三章", "category": "daoist"},
            {"number": 39, "title": "知不知上", "body": "知不知，上；不知知，病。", "explanation": "知道自己有所不知，保持谦逊和开放的心。", "source": "《道德经》第七十一章", "category": "daoist"},
            {"number": 40, "title": "天道无亲", "body": "天道无亲，常与善人。", "explanation": "天道没有偏爱，但常常眷顾善良的人。", "source": "《道德经》第七十九章", "category": "daoist"},
            {"number": 41, "title": "逍遥游", "body": "至人无己，神人无功，圣人无名。", "explanation": "放下对功名的追求，你才能真正逍遥。", "source": "《庄子·逍遥游》", "category": "daoist"},
            {"number": 42, "title": "齐物", "body": "天地与我并生，而万物与我为一。", "explanation": "你与天地万物本是一体，一切都是相连的。", "source": "《庄子·齐物论》", "category": "daoist"},
            {"number": 43, "title": "庖丁解牛", "body": "依乎天理，批大郤，导大窾，因其固然。", "explanation": "顺着事物的自然纹理而行，顺势而为，不勉强。", "source": "《庄子·养生主》", "category": "daoist"},
            {"number": 44, "title": "无用之用", "body": "人皆知有用之用，而莫知无用之用也。", "explanation": "世人只看到有用的价值，却不知无用才是大用。", "source": "《庄子·人间世》", "category": "daoist"},
            {"number": 45, "title": "心斋", "body": "若一志，无听之以耳而听之以心，无听之以心而听之以气。", "explanation": "用气去感受，而非用耳朵或心念去分析。", "source": "《庄子·人间世》", "category": "daoist"},
            {"number": 46, "title": "坐忘", "body": "堕肢体，黜聪明，离形去知，同于大通，此谓坐忘。", "explanation": "放下身体和心智的束缚，与大道融为一体。", "source": "《庄子·大宗师》", "category": "daoist"},
            {"number": 47, "title": "无为而治", "body": "无为而万物化。", "explanation": "不必刻意强求，有时候不做什么，反而是最好的作为。", "source": "《庄子·天地》", "category": "daoist"},
            {"number": 48, "title": "邯郸学步", "body": "寿陵馀子之学行于邯郸，未得国能，又失其故行。", "explanation": "不必模仿他人，走你自己的路就好。", "source": "《庄子·秋水》", "category": "daoist"},
            {"number": 49, "title": "鱼之乐", "body": "子非鱼，安知鱼之乐？", "explanation": "每个人的修行体验都是独特的，尊重自己的节奏。", "source": "《庄子·秋水》", "category": "daoist"},
            {"number": 50, "title": "材与不材", "body": "周将处乎材与不材之间。", "explanation": "你的存在本身就是价值，不必证明自己。", "source": "《庄子·山木》", "category": "daoist"},
        ]

        tracks_data = [
            {"name": "Gentle Rain", "name_cn": "细雨", "category": "rain", "file_path": "rain.mp3", "duration_s": 600},
            {"name": "Forest Stream", "name_cn": "溪流", "category": "water", "file_path": "stream.mp3", "duration_s": 600},
            {"name": "Singing Bowl", "name_cn": "颂钵", "category": "bowl", "file_path": "singing_bowl.mp3", "duration_s": 300},
            {"name": "Mountain Wind", "name_cn": "山风", "category": "wind", "file_path": "wind.mp3", "duration_s": 600},
            {"name": "Temple Bells", "name_cn": "梵钟", "category": "bell", "file_path": "temple_bells.mp3", "duration_s": 300},
            {"name": "Thunder", "name_cn": "雷鸣", "category": "thunder", "file_path": "thunder.mp3", "duration_s": 600},
        ]

        for d in lots_data:
            db.add(Lot(**d))
        for d in tracks_data:
            db.add(WhiteNoiseTrack(**d))
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_if_empty()
    yield


app = FastAPI(title="修行记录", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(contents.router)
app.include_router(practices.router)
app.include_router(lots.router)
app.include_router(white_noise.router)
app.include_router(messages.router)

# Serve frontend static files in production
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
else:
    frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
    if os.path.isdir(frontend_dist):
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
