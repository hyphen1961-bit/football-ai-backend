# DB-Schema Referenz — Football AI Kumpel-Tipp
Stand: 24.09.2026

## matches
| Spalte | Typ | Nullable |
|---|---|---|
| id | uuid | NO |
| api_fixture_id | bigint | NO |
| league_id | integer | YES |
| season | integer | YES |
| round | varchar | YES |
| home_team_id | integer | YES |
| home_team_name | varchar | YES |
| away_team_id | integer | YES |
| away_team_name | varchar | YES |
| kickoff_time | timestamptz | YES |
| status | varchar | YES |
| home_score | integer | YES |
| away_score | integer | YES |
| created_at | timestamptz | YES |
| league_name | text | YES |

## match_analysis
| Spalte | Typ | Nullable |
|---|---|---|
| id | uuid | NO |
| api_fixture_id | bigint | YES |
| form_home | jsonb | YES |
| form_away | jsonb | YES |
| injuries_home | jsonb | YES |
| injuries_away | jsonb | YES |
| h2h_stats | jsonb | YES |
| odds_home | numeric | YES |
| odds_draw | numeric | YES |
| odds_away | numeric | YES |
| home_advantage_factor | numeric | YES |
| context_notes | text | YES |
| ai_prediction | varchar | YES |
| confidence_score | integer | YES |
| analyzed_at | timestamptz | YES |

## match_results  ⚠️ separat von matches.home_score/away_score — Rolle noch nicht geklärt
| Spalte | Typ | Nullable |
|---|---|---|
| id | uuid | NO |
| api_fixture_id | integer | NO |
| home_score | integer | YES |
| away_score | integer | YES |
| status | varchar | YES |
| created_at | timestamptz | YES |

## tracking_stats  ⚠️ UNRESTRICTED (kein RLS!) — vermutlich für KI-Genauigkeits-Tracking gedacht
| Spalte | Typ | Nullable |
|---|---|---|
| id | uuid | NO |
| match_id | uuid | YES |
| league | text | YES |
| prediction | text | YES |
| actual_result | text | YES |
| is_correct | boolean | YES |
| created_at | timestamptz | YES |

## user_tips  ⚠️ zwei Spaltenpaare fürs Ergebnis — Duplikat klären
| Spalte | Typ | Nullable |
|---|---|---|
| id | uuid | NO |
| user_id | uuid | YES |
| api_fixture_id | bigint | YES |
| predicted_winner | varchar | YES |
| predicted_score_home | integer | YES |
| predicted_score_away | integer | YES |
| tip_over_under | varchar | YES |
| tip_btts | varchar | YES |
| tip_double_chance | varchar | YES |
| tip_exact_score_home | integer | YES |
| tip_exact_score_away | integer | YES |
| deviation_reason | varchar | YES |
| created_at | timestamptz | YES |

## user_scores
| Spalte | Typ | Nullable |
|---|---|---|
| id | uuid | NO |
| user_id | uuid | NO |
| username | varchar | NO |
| total_points | integer | YES |
| correct_1x2 | integer | YES |
| correct_exact_score | integer | YES |
| correct_with_deviation | integer | YES |
| current_streak | integer | YES |
| best_streak | integer | YES |
| tips_count | integer | YES |
| updated_at | timestamptz | YES |

## users
| Spalte | Typ | Nullable |
|---|---|---|
| id | uuid | NO |
| username | text | YES |
| created_at | timestamptz | YES |
| email | text | YES |
| raw_user_meta_data | jsonb | YES |
| display_name | text | YES |
| avatar_url | text | YES |

⚠️ Keine `role`-Spalte vorhanden, obwohl ein altes Admin-SQL-Skript sie referenziert — dieses Skript würde aktuell fehlschlagen.

---

## Offene Baustellen (Stand 24.09.2026)
1. **`tracking_stats` hat kein RLS** — sollte noch abgesichert werden.
2. **Zwei Ergebnis-Spaltenpaare in `user_tips`**: `predicted_score_home/away` vs. `tip_exact_score_home/away` — eins davon ist vermutlich überflüssig.
3. **Zwei Orte für Match-Ergebnisse**: `matches.home_score/away_score` vs. eigene Tabelle `match_results` — muss vereinheitlicht werden.
4. **Frontend/Backend-Mismatch**: `MatchModal.tsx` schickt hartcodiert `username: 'Urs'`, Backend erwartet `user_id` als Pflichtfeld.
5. **Scoring-Engine fehlt komplett** — das ist der nächste grosse Baustein.
