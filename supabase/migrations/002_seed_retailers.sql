-- Retailers we plan to cover. melbourne_pickup / shipping_notes feed the Melbourne convenience score (Phase 3).
-- Review and correct these if anything's changed.
insert into retailers (id, name, website, kind, melbourne_pickup, shipping_notes) values
  ('ozbargain',  'OzBargain',    'https://www.ozbargain.com.au', 'aggregator', false, 'Community deal aggregator'),
  ('staticice',  'StaticICE',    'https://www.staticice.com.au', 'aggregator', false, 'Price comparison aggregator'),
  ('pccasegear', 'PC Case Gear', 'https://www.pccasegear.com',   'retailer',   true,  'Melbourne-based (Mulgrave VIC); fast VIC shipping'),
  ('scorptec',   'Scorptec',     'https://www.scorptec.com.au',  'retailer',   true,  'Melbourne stores (Clayton etc.)'),
  ('umart',      'Umart',        'https://www.umart.com.au',     'retailer',   true,  'Melbourne stores'),
  ('msy',        'MSY',          'https://www.msy.com.au',       'retailer',   true,  'Melbourne stores'),
  ('centrecom',  'Centre Com',   'https://www.centrecom.com.au', 'retailer',   true,  'Melbourne-based, several VIC stores'),
  ('mwave',      'Mwave',        'https://www.mwave.com.au',     'retailer',   false, 'Sydney-based; ships nationally'),
  ('jbhifi',     'JB Hi-Fi',     'https://www.jbhifi.com.au',    'retailer',   true,  'Many Melbourne stores; click & collect'),
  ('amazon-au',  'Amazon AU',    'https://www.amazon.com.au',    'retailer',   false, 'Free/fast shipping with Prime')
on conflict (id) do update set
  name = excluded.name,
  website = excluded.website,
  kind = excluded.kind;
