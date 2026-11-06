import type { ScraperModule } from "./core/types";
import { mwave } from "./sources/mwave";
import { ozbargain } from "./sources/ozbargain";
import { pccasegear } from "./sources/pccasegear";
import { scorptec } from "./sources/scorptec";
import { amazonAu, centrecom, jbhifi } from "./sources/skipped";
import { staticice } from "./sources/staticice";
import { msy, umart } from "./sources/umart";

/**
 * All scrapers. To add a retailer:
 *   1. create scrapers/sources/<id>.ts exporting a ScraperModule
 *   2. add it to this list
 *   3. make sure a row with the same id exists in the `retailers` table (see supabase/migrations)
 */
export const scrapers: ScraperModule[] = [
  ozbargain,
  mwave,
  pccasegear,
  scorptec,
  umart,
  msy,
  staticice,
  // not scraped — logged as "blocked" with the reason
  centrecom,
  jbhifi,
  amazonAu,
];
