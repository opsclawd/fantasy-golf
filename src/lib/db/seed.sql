-- Sample golfers (would be populated from Slash Golf API in production)
INSERT INTO golfers (id, name, country) VALUES
  ('g1', 'Scottie Scheffler', 'USA'),
  ('g2', 'Rory McIlroy', 'NIR'),
  ('g3', 'Jon Rahm', 'ESP'),
  ('g4', 'Brooks Koepka', 'USA'),
  ('g5', 'Bryson DeChambeau', 'USA'),
  ('g6', 'Phil Mickelson', 'USA'),
  ('g7', 'Collin Morikawa', 'USA'),
  ('g8', 'Viktor Hovland', 'NOR'),
  ('g9', 'Patrick Cantlay', 'USA'),
  ('g10', 'Xander Schauffele', 'USA')
ON CONFLICT (id) DO NOTHING;
