#!/usr/bin/env python3
"""Launch kit for Gorilla Squad and Thebes, in one script.

It writes drafts and a posting schedule. It does not post anything. Every post, reel or comment is meant to be
read and sent by a person, in the right place, with the affiliation disclosed.

    python3 launch/launch.py            # writes launch/out/
    python3 launch/launch.py --check    # also fails if the same text is used twice (spam guard)

Standard library only.
"""
import csv
import hashlib
import os
import sys
from collections import defaultdict

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
SITE = {"gorilla": "gorillasquad.co", "thebes": "Thebes (the app link goes here)"}
DISCLOSE = "Disclosure: I'm part of the team behind {name}."

PRODUCTS = {
    "gorilla": {
        "name": "Gorilla Squad",
        "pitch": "Put your product in your customers' hands. Local people share it, you pay only for checked results.",
        "reels": [
            ("List a product in 2 minutes", "Show the form: product link, pitch, flyer, reward. Caption: 'Your product, shared by people who live where you sell.'"),
            ("A marketer's day", "Show the board: local campaign, copy snippet and link, QR code, live counter ticking up."),
            ("Real results", "Show a wallet with a verified click payout. Only use a real, consented result. Never fake numbers."),
        ],
        "reddit": [
            ("r/forhire", "Hiring marketers: share local products, paid on checked results. Details and sign-up link in the post."),
            ("r/entrepreneur", "We let small sellers list a product and pay local people to share it instead of running ads. Would you use it? What would stop you?"),
        ],
        "communities": {
            "artists": "Artists: if you sell prints, merch or commissions, you can list one product and let people in your city share it. You pay per checked result. Happy to answer questions here.",
            "writers": "Writers: a book or newsletter can be listed the same way. Local readers share a snippet and a link, and you pay when a sign-up is checked. Disclosure: I'm part of the team behind Gorilla Squad.",
            "producers": "Producers: an event, a beat pack or a release can be shared by people near the venue or fans in your city. Pay per click or per checked post. Disclosure: I'm part of the team behind Gorilla Squad.",
            "entrepreneurs": "Founders: if you can't afford ads yet, try listing one product and paying local people to share it, per checked result. Disclosure: I'm part of the team behind Gorilla Squad.",
        },
    },
    "thebes": {
        "name": "Thebes",
        "pitch": "Branded games for small businesses, with leaderboards, prizes from the brand, and an opt-in mailing list.",
        "reels": [
            ("Trivia in 30 seconds", "Hook: 'Can you get 4 of 4?' Show one question on screen, the timer, the answer. Caption links to the game."),
            ("Wordle, branded", "Show a branded Wordle board for a real local shop, one solve, then the leaderboard."),
            ("Behind a game", "Show the design step: pick a template, add the logo, the AI fills the words, you check the preview."),
        ],
        "reddit": [
            ("r/WordleGame", "We made a daily branded Wordle for a local shop. Feedback on difficulty welcome. Not selling anything in this post."),
            ("r/trivia", "Built a 90-second trivia sprint with a leaderboard. What makes a question good to you? Asking for tough feedback."),
        ],
        "communities": {
            "artists": "Artists: a fan trivia about your work can be a game with a leaderboard. Disclosure: I'm part of the team behind Thebes.",
            "writers": "Writers: a quiz about your book is a fun way to reach readers. Disclosure: I'm part of the team behind Thebes.",
            "producers": "Producers: a release quiz with a prize from the label works as a game. Disclosure: I'm part of the team behind Thebes.",
            "entrepreneurs": "Founders: a branded game gives customers a reason to come back and leave an email. Disclosure: I'm part of the team behind Thebes.",
        },
    },
}

GAME_QUALITY = [
    ("Clear rules in one line", "A player knows what to do in 3 seconds."),
    ("Difficulty you can tune", "Tries, time and question difficulty are settings, so every contest can be right for its audience."),
    ("Fair scoring", "Server-side scoring, a fixed answer order, no way to see the answer in the page."),
    ("A reason to come back", "Daily or series episodes, and a leaderboard that moves."),
    ("The brand is in the game", "Logo, colours and the prize are visible at each step, not just on the splash screen."),
    ("A finish that matters", "A winner is named, or a result is shown, when the game closes."),
]

SCHEDULE_WEEKS = [
    ("Week 1", "gorilla", "Post reel 1 on Instagram; post the r/forhire post; send the first community reply by hand (2 threads)."),
    ("Week 1", "thebes", "Post a game reel (trivia) on Instagram; check the game is playable on a phone."),
    ("Week 2", "gorilla", "Reel 2 and r/entrepreneur; 3 more community replies, each written for its thread."),
    ("Week 2", "thebes", "Wordle reel with a real local shop (with their permission); r/WordleGame post."),
    ("Week 3", "gorilla", "Reel 3 with a real, consented result; count what worked and drop what did not."),
    ("Week 3", "thebes", "Design reel; collect feedback on difficulty from the 2 Reddit threads."),
]


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text.strip() + "\n")


def build(key, p):
    name = p["name"]
    reels = "\n\n".join(
        f"## Reel {i}: {title}\n\nScript: {beat}\n\nCaption: {p['pitch']} {DISCLOSE.format(name=name)}\n"
        f"Hashtags: #smallbusiness #{key} #localbusiness\n"
        for i, (title, beat) in enumerate(p["reels"], 1))
    reddit = "\n\n".join(
        f"## {sub}\n\n{text}\n\nRead the subreddit's self-promotion rules before posting. Post as yourself, with the disclosure above."
        for sub, text in p["reddit"])
    comments = "\n\n".join(
        f"## {section.title()}\n\n{text}\n\nReply in a thread you have read. Change the first line to fit that thread."
        for section, text in p["communities"].items())
    write(os.path.join(OUT, key, "instagram_reels.md"), f"# {name}: Instagram reels\n\n{reels}")
    write(os.path.join(OUT, key, "reddit.md"), f"# {name}: Reddit\n\n{reddit}")
    write(os.path.join(OUT, key, "community_replies.md"), f"# {name}: replies in artist, writer, producer and founder spaces\n\n{comments}")


def check_duplicates():
    """Return the drafts that appear more than once in the kit (identical copy is what gets flagged as spam)."""
    seen = defaultdict(list)
    for key, p in PRODUCTS.items():
        for section, text in p["communities"].items():
            seen[hashlib.sha256(text.encode()).hexdigest()].append(f"{key}/{section}")
        for sub, text in p["reddit"]:
            seen[hashlib.sha256(text.encode()).hexdigest()].append(f"{key}/{sub}")
    return {h: v for h, v in seen.items() if len(v) > 1}


def main():
    dups = check_duplicates()
    if "--check" in sys.argv and dups:
        print("Duplicate drafts found, rewrite these before posting:")
        for places in dups.values():
            print("  -", ", ".join(places))
        sys.exit(1)
    for key, p in PRODUCTS.items():
        build(key, p)
    write(os.path.join(OUT, "thebes", "game_quality_checklist.md"),
          "# Thebes: what makes a game hold attention\n\n" + "\n".join(f"- **{a}.** {b}" for a, b in GAME_QUALITY))
    with open(os.path.join(OUT, "schedule.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["week", "product", "task", "owner", "done"])
        for week, key, task in SCHEDULE_WEEKS:
            w.writerow([week, PRODUCTS[key]["name"], task, "you", ""])
    write(os.path.join(OUT, "README.md"), """# Launch kit

- gorilla/: reels, Reddit posts and community replies for Gorilla Squad
- thebes/: reels, Reddit posts, replies and the game quality checklist
- schedule.csv: three weeks, one line per task

Nothing here posts by itself. Read each draft, adjust it for the place you post, and post it as yourself.
Disclose any affiliation. Do not send the same text to several threads.
""")
    print(f"Wrote drafts to {OUT}. Duplicate drafts: {len(dups)}.")


if __name__ == "__main__":
    main()
