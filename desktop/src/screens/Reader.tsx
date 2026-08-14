import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { crawl, imgSrc } from "../api";

export default function Reader() {
    const { source, comicId, chapterIndex } = useParams();
    const id = comicId ? decodeURIComponent(comicId) : "";
    const [images, setImages] = useState<string[]>([]);

    useEffect(() => {
        crawl<string[]>("images", source!, {
            comicId: id,
            chapterIndex: Number(chapterIndex),
        })
            .then(setImages)
            .catch(console.error);
    }, [source, id, chapterIndex]);

    return (
        <div style={{ fontFamily: "system-ui" }}>
            <div
                style={{
                    position: "sticky",
                    top: 0,
                    background: "#fff",
                    padding: 8,
                    borderBottom: "1px solid #eee",
                }}
            >
                <Link to={`/comic/${source}/${encodeURIComponent(id)}`}>← 章节</Link>
            </div>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    padding: 8,
                }}
            >
                {images.map((src, i) => (
                    <img
                        key={i}
                        src={imgSrc(src)}
                        alt={`page ${i + 1}`}
                        style={{ width: "100%", maxWidth: 720, background: "#f5f5f5" }}
                    />
                ))}
            </div>
        </div>
    );
}
