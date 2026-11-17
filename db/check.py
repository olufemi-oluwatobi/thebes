# Runs every migration and seed in an in-memory SQLite (what D1 is), inserts sample rows and checks that bad rows are refused.
import sqlite3, glob, json, sys
db = sqlite3.connect(':memory:'); db.execute('PRAGMA foreign_keys=ON')
for f in sorted(glob.glob('db/migrations/*.sql')) + sorted(glob.glob('db/seed/*.sql')):
    db.executescript(open(f).read()); print('ok', f)
t = 1763337600000
q = lambda s, *a: db.execute(s, a)
q("insert into users(id,email,created_at,updated_at) values('u1','ama@mamas.example',?,?)", t, t)
q("insert into companies(id,slug,name,brand,created_by,created_at,updated_at) values('c1','mamas-diner',?,?, 'u1',?,?)", "Mama's Diner", json.dumps({"colors":{"primary":"#ff5a47"}}), t, t)
q("insert into company_members values('c1','u1','owner',null,?)", t)
q("insert into subscriptions(company_id,plan_id,period_start,updated_at) values('c1','free',?,?)", t, t)
q("insert into assets(id,company_id,kind,r2_key,mime,bytes,sha256,created_by,created_at) values('a1','c1','logo','c1/logo.png','image/png',1200,'x','u1',?)", t)
q("insert into series(id,company_id,game_type_id,slug,name,template_id,created_at) values('s1','c1','wordle','mamas-daily','The Daily Word','pop-player',?)", t)
q("insert into contests(id,company_id,created_by,type,game_type_id,series_id,episode,slug,title,settings,created_at,updated_at) values('k1','c1','u1','daily','wordle','s1',1,'daily-001','The Daily Word',?,?,?)", json.dumps({"tries":6,"time":180,"series":"mamas-daily"}), t, t)
q("insert into contest_secrets values('k1',?)", json.dumps({"word":"toast"}))
q("insert into contest_assets values('k1','logo','a1')")
q("insert into contest_builds(id,contest_id,version,template_id,template_version,slot_values,source_key,engine,status,made_by,created_at) values('b1','k1',1,'pop-player',1,'{}','k','game@1','ok','wizard',?)", t)
q("insert into design_sessions(id,company_id,user_id,contest_id,step,created_at,updated_at) values('d1','c1','u1','k1','design',?,?)", t, t)
q("insert into design_turns(id,session_id,kind,patch,ok,created_at) values('t1','d1','design','{}',1,?)", t)
q("insert into players(id,user_id,created_at,last_seen_at) values('p1','u1',?,?)", t, t)
q("insert into plays(id,contest_id,player_id,status,tries,ms,score,started_at) values('pl1','k1','p1','won',3,61000,30061000,?)", t)
q("insert into play_moves values('pl1',1,'crane','[\"absent\",\"absent\",\"correct\",\"absent\",\"absent\"]',4000)")
q("insert into entries(id,contest_id,company_id,player_id,play_id,email,consent,consent_text,created_at) values('e1','k1','c1','p1','pl1','kofi@example.com',1,'I agree',?)", t)
q("insert into likes values('k1','u1',?)", t); q("insert into follows values('u1','c1',?)", t)
q("insert into comments(id,contest_id,user_id,body,created_at) values('m1','k1','u1','got it in 3',?)", t)
q("insert into contest_counters(contest_id,updated_at) values('k1',?)", t)
# things that must be refused
bad = [
 ("daily contest without a series", "insert into contests(id,company_id,created_by,type,game_type_id,slug,title,created_at,updated_at) values('k2','c1','u1','daily','wordle','x','x',1,1)"),
 ("unknown contest type", "insert into contests(id,company_id,created_by,type,game_type_id,slug,title,created_at,updated_at) values('k3','c1','u1','raffle','wordle','y','y',1,1)"),
 ("ends before it starts", "insert into contests(id,company_id,created_by,type,game_type_id,slug,title,starts_at,ends_at,created_at,updated_at) values('k4','c1','u1','contest','wordle','z','z',10,5,1,1)"),
 ("bad json", "insert into contest_secrets values('k1','not json')"),
 ("second play by the same player", "insert into plays(id,contest_id,player_id,started_at) values('pl2','k1','p1',1)"),
 ("member of a company that does not exist", "insert into company_members values('nope','u1','owner',null,1)"),
 ("build from a template version that does not exist", "insert into contest_builds(id,contest_id,version,template_id,template_version,slot_values,source_key,engine,status,made_by,created_at) values('b2','k1',2,'pop-player',9,'{}','k','game@1','ok','wizard',1)"),
 ("empty comment", "insert into comments(id,contest_id,user_id,body,created_at) values('m2','k1','u1','',1)"),
]
for name, sql in bad:
    try: db.execute(sql); print('NOT REFUSED:', name); sys.exit(1)
    except sqlite3.IntegrityError as e: print('refused:', name, '-', e)
print('tables:', db.execute("select count(*) from sqlite_master where type='table'").fetchone()[0])
print('feed query plan:', db.execute("explain query plan select id from contests where status='live' and visibility='public' and deleted_at is null order by starts_at desc limit 20").fetchall()[-1][-1])
