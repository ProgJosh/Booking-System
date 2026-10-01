import { errorMessage } from "../lib/validation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Star,
  Users,
  ChevronLeft,
  ChevronRight,
  Check,
  Search,
} from "lucide-react";
import { api } from "../lib/api";
import { addDays, dateKey, money } from "../lib/date";
import {
  validateDates,
  type TravelData,
  type StaySearch,
  type Property,
  type Room,
} from "../lib/travel";
import { Empty, ErrorNotice, Field } from "../components/ui";
export const initialSearch = (): StaySearch => ({
  destination: "",
  checkIn: addDays(dateKey(), 7),
  checkOut: addDays(dateKey(), 9),
  guests: 2,
});
function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current!;
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      node.classList.add("revealed");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          node.classList.add("revealed");
          observer.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={"travel-reveal " + className}>
      {children}
    </div>
  );
}
export function AvailabilitySearch({
  data,
  value,
  onSearch,
  compact = false,
}: {
  data: TravelData;
  value: StaySearch;
  onSearch: (s: StaySearch) => void;
  compact?: boolean;
}) {
  const [input, setInput] = useState(value),
    [error, setError] = useState("");
  useEffect(() => setInput(value), [value]);
  return (
    <form
      className={"availability " + (compact ? "compact" : "")}
      onSubmit={(e) => {
        e.preventDefault();
        try {
          validateDates(input.checkIn, input.checkOut);
          if (
            !Number.isInteger(input.guests) ||
            input.guests < 1 ||
            input.guests > 12
          )
            throw new Error("Choose between 1 and 12 guests.");
          setError("");
          onSearch(input);
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <Field label="Where to?">
        <select
          value={input.destination}
          onChange={(e) => setInput({ ...input, destination: e.target.value })}
        >
          <option value="">Anywhere feels good</option>
          {[
            ...new Set(
              data.properties.filter((p) => p.active).map((p) => p.destination),
            ),
          ].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </Field>
      <Field label="Check-in">
        <input
          type="date"
          required
          min={dateKey()}
          value={input.checkIn}
          onChange={(e) => setInput({ ...input, checkIn: e.target.value })}
        />
      </Field>
      <Field label="Check-out">
        <input
          type="date"
          required
          min={addDays(input.checkIn || dateKey(), 1)}
          value={input.checkOut}
          onChange={(e) => setInput({ ...input, checkOut: e.target.value })}
        />
      </Field>
      <Field label="Guests">
        <select
          value={input.guests}
          onChange={(e) =>
            setInput({ ...input, guests: Number(e.target.value) })
          }
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1} {i === 0 ? "guest" : "guests"}
            </option>
          ))}
        </select>
      </Field>
      <button className="btn primary" type="submit">
        <Search size={17} />
        Find my escape
      </button>
      {error && <ErrorNotice error={error} />}
    </form>
  );
}
function PropertyCard({
  property: p,
  price,
  onOpen,
}: {
  property: Property;
  price: number;
  onOpen: () => void;
}) {
  return (
    <article className="stay-card">
      <button
        className="stay-photo"
        onClick={onOpen}
        aria-label={"Explore " + p.name}
      >
        <img
          src={p.image}
          alt={p.kind + " scenery illustrating this destination"}
          loading="lazy"
          width="1000"
          height="700"
        />
        <span className="photo-label">
          {p.kind === "Forest"
            ? "A little closer to nature"
            : p.kind === "Island"
              ? "Island state of mind"
              : "By the water"}
        </span>
        <span className="photo-arrow">
          <ArrowUpRight size={20} />
        </span>
      </button>
      <div className="stay-body">
        <div className="card-location">
          <span>
            <MapPin size={13} />
            {p.destination}
          </span>
          <span>
            <Star size={13} />
            {p.rating.toFixed(1)} <small>sample</small>
          </span>
        </div>
        <h3>
          <button onClick={onOpen}>{p.name}</button>
        </h3>
        <p>{p.amenities.slice(0, 3).join(" · ")}</p>
        <div className="stay-bottom">
          <span>
            <strong>{money(price)}</strong> / night
          </span>
          <button className="text-btn" onClick={onOpen}>
            Discover stay
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
type Props = {
  data: TravelData;
  page: string;
  search: StaySearch;
  onSearch: (s: StaySearch) => void;
  onProperty: (id: string) => void;
  onReserve: (room: Room) => void;
};
export function TravelSite({
  data,
  page,
  search,
  onSearch,
  onProperty,
  onReserve,
}: Props) {
  const [kind, setKind] = useState("All"),
    [sort, setSort] = useState("recommended"),
    [budget, setBudget] = useState(20000),
    [amenity, setAmenity] = useState(""),
    [slide, setSlide] = useState(0);
  useEffect(() => setSlide(0), [page]);
  const available = (r: Room) => {
    try {
      return (
        r.active &&
        r.capacity >= search.guests &&
        api.available(r.id, search.checkIn, search.checkOut) > 0
      );
    } catch {
      return false;
    }
  };
  const minPrice = (p: Property, filtered = false) =>
    Math.min(
      ...data.rooms
        .filter(
          (r) =>
            r.propertyId === p.id && r.active && (!filtered || available(r)),
        )
        .map((r) => r.price),
    );
  const active = data.properties.filter(
    (p) =>
      p.active && data.rooms.some((r) => r.propertyId === p.id && r.active),
  );
  if (page.startsWith("property/")) {
    const p = data.properties.find(
      (p) => p.id === page.split("/")[1] && p.active,
    );
    if (!p || !data.rooms.some((r) => r.propertyId === p.id && r.active))
      return (
        <div className="travel-container">
          <Empty
            title="This stay is unavailable"
            text="Explore another destination in our collection."
            action={
              <button className="btn primary" onClick={() => onSearch(search)}>
                Explore stays
              </button>
            }
          />
        </div>
      );
    const gallery = p.gallery.length ? p.gallery : [p.image];
    return (
      <main className="property-page travel-container">
        <button className="text-btn back-link" onClick={() => onSearch(search)}>
          <ChevronLeft size={16} />
          Back to stays
        </button>
        <div className="property-title">
          <div>
            <p className="eyebrow">
              {p.destination} · {p.kind} retreat
            </p>
            <h1>{p.name}</h1>
            <p>
              <Star size={16} /> {p.rating.toFixed(1)} sample guest rating ·
              Fictional demo property
            </p>
          </div>
          <button
            className="btn primary"
            onClick={() =>
              document.getElementById("rooms")?.scrollIntoView({
                behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "instant"
                  : "smooth",
              })
            }
          >
            Choose your room
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="property-gallery">
          <img
            src={gallery[slide % gallery.length]}
            alt={
              slide === 1
                ? "Illustrative guest room interior"
                : "Atmosphere photograph for " + p.name
            }
            width="1200"
            height="700"
          />
          <button
            className="gallery-prev"
            aria-label="Previous photograph"
            onClick={() =>
              setSlide((slide + gallery.length - 1) % gallery.length)
            }
          >
            <ChevronLeft />
          </button>
          <button
            className="gallery-next"
            aria-label="Next photograph"
            onClick={() => setSlide((slide + 1) % gallery.length)}
          >
            <ChevronRight />
          </button>
          <span>
            {slide + 1} / {gallery.length} · Illustrative photography
          </span>
        </div>
        <div className="gallery-thumbs">
          {gallery.map((img, i) => (
            <button
              key={i}
              aria-label={"View photograph " + (i + 1)}
              aria-pressed={slide === i}
              onClick={() => setSlide(i)}
            >
              <img src={img} alt="" loading="lazy" />
            </button>
          ))}
        </div>
        <div className="property-info">
          <div>
            <p className="eyebrow">Stay a little, remember a lot</p>
            <h2>A place to slow down.</h2>
            <p className="lead">{p.description}</p>
            <div className="amenities">
              {p.amenities.map((a) => (
                <span key={a}>
                  <Check size={16} />
                  {a}
                </span>
              ))}
            </div>
            <h3>Good to know</h3>
            <p>{p.policy}</p>
            <h3>Your corner of the world</h3>
            <p>
              <MapPin size={16} /> {p.address}
            </p>
            <p className="fine-print">
              This is a fictional resort for exploring the booking system.
              Images show travel atmosphere and do not depict an actual listed
              property. No real stay is reserved.
            </p>
          </div>
          <aside className="detail-note">
            <span className="eyebrow">Make room for a good day</span>
            <h3>
              Thoughtfully chosen.
              <br />
              Beautifully unhurried.
            </h3>
            <p>
              From <strong>{money(minPrice(p))}</strong> per room, per night.
            </p>
            <p>
              Clear prices. Flexible dates before arrival. Local payment
              preferences, with no payment collected.
            </p>
            <button
              className="btn primary"
              onClick={() => document.getElementById("rooms")?.scrollIntoView()}
            >
              Check availability
              <ArrowRight size={16} />
            </button>
          </aside>
        </div>
        <section id="rooms" className="travel-section">
          <p className="eyebrow">Your stay, your way</p>
          <h2>Find your favorite room.</h2>
          <AvailabilitySearch
            data={data}
            value={search}
            compact
            onSearch={(s) => {
              onSearch(s);
              onProperty(p.id);
            }}
          />
          <div className="room-grid">
            {data.rooms
              .filter((r) => r.propertyId === p.id && r.active)
              .map((r) => (
                <article className="room-card" key={r.id}>
                  <img
                    src={r.image}
                    alt={"Illustrative interior for " + r.name}
                    loading="lazy"
                    width="1000"
                    height="700"
                  />
                  <div>
                    <h3>{r.name}</h3>
                    <p>{r.description}</p>
                    <p>
                      <Users size={16} /> Up to {r.capacity} guests ·{" "}
                      {r.amenities.join(" · ")}
                    </p>
                    <div className="room-price">
                      <span>
                        <strong>{money(r.price)}</strong> / night
                      </span>
                      <button
                        className="btn primary"
                        disabled={!available(r)}
                        onClick={() => onReserve(r)}
                      >
                        {available(r)
                          ? "Reserve this room"
                          : "Unavailable for your search"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        </section>
        <section className="travel-section">
          <p className="eyebrow">More than a room</p>
          <h2>Make the most of being here.</h2>
          <div className="experience-grid">
            {data.experiences
              .filter((e) => e.propertyId === p.id && e.active)
              .map((e) => (
                <article className="experience-card" key={e.id}>
                  <img
                    src={e.image}
                    alt={"Atmosphere for " + e.name}
                    loading="lazy"
                    width="1000"
                    height="700"
                  />
                  <div>
                    <h3>{e.name}</h3>
                    <p>{e.description}</p>
                    <strong>{money(e.price)} / reservation</strong>
                    <p className="fine-print">
                      Add this experience when reserving a room.
                    </p>
                  </div>
                </article>
              ))}
          </div>
        </section>
      </main>
    );
  }
  if (page === "stays") {
    const results = active
      .filter(
        (p) =>
          (!search.destination || p.destination === search.destination) &&
          (kind === "All" || p.kind === kind) &&
          (!amenity ||
            p.amenities.some((a) =>
              a.toLowerCase().includes(amenity.toLowerCase()),
            )) &&
          data.rooms.some(
            (r) => r.propertyId === p.id && available(r) && r.price <= budget,
          ),
      )
      .sort((a, b) =>
        sort === "price"
          ? minPrice(a, true) - minPrice(b, true)
          : b.rating - a.rating,
      );
    return (
      <main className="travel-container search-page">
        <p className="eyebrow">Small collection. Extraordinary feeling.</p>
        <h1>Your next good place.</h1>
        <p className="lead">
          Island mornings, forest air, and rooms worth slowing down for.
        </p>
        <AvailabilitySearch
          data={data}
          value={search}
          compact
          onSearch={onSearch}
        />
        <div className="filter-bar">
          <div className="filter-chips" aria-label="Stay setting">
            {["All", "Island", "Coast", "Forest"].map((k) => (
              <button
                key={k}
                aria-pressed={kind === k}
                className={kind === k ? "selected" : ""}
                onClick={() => setKind(k)}
              >
                {k === "All" ? "All stays" : k}
              </button>
            ))}
          </div>
          <Field label="Nightly budget">
            <select
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            >
              <option value={20000}>Any price</option>
              <option value={6000}>Up to ₱6,000</option>
              <option value={4500}>Up to ₱4,500</option>
            </select>
          </Field>
          <Field label="Amenity">
            <select
              value={amenity}
              onChange={(e) => setAmenity(e.target.value)}
            >
              <option value="">Any amenity</option>
              {["Pool", "Breakfast", "Beach"].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Sort by">
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recommended">Recommended</option>
              <option value="price">Price: low to high</option>
            </select>
          </Field>
        </div>
        <p className="result-count" role="status">
          {results.length} available {results.length === 1 ? "stay" : "stays"} ·{" "}
          {search.checkIn} to {search.checkOut} · {search.guests} guests
        </p>
        <div className="stay-grid">
          {results.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              price={minPrice(p, true)}
              onOpen={() => onProperty(p.id)}
            />
          ))}
        </div>
        {!results.length && (
          <Empty
            title="A different date could make all the difference"
            text="Try fewer guests, another destination, or a wider budget."
            action={
              <button
                className="btn primary"
                onClick={() => {
                  setKind("All");
                  setBudget(20000);
                  setAmenity("");
                  onSearch(initialSearch());
                }}
              >
                Reset search
              </button>
            }
          />
        )}
      </main>
    );
  }
  return (
    <main>
      <section className="travel-hero">
        <img
          src="/images/hero.jpg"
          alt="Sunlit resort pool framed by tropical palms and welcoming terraces"
          width="1920"
          height="1280"
          fetchPriority="high"
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <p className="eyebrow">Thoughtful stays. A world of possibility.</p>
          <h1>
            Find your kind
            <br />
            of <em>elsewhere.</em>
          </h1>
          <p>
            Beautiful places. A slower pace.
            <br />
            Your next chapter starts with a stay.
          </p>
          <button className="btn ivory" onClick={() => onSearch(search)}>
            Explore stays
            <ArrowUpRight size={19} />
          </button>
        </div>
        <div className="hero-caption">
          <span>01 — A little closer to paradise</span>
          <span>THE PHILIPPINES, AT YOUR PACE</span>
        </div>
      </section>
      <div className="travel-container search-overlap">
        <AvailabilitySearch data={data} value={search} onSearch={onSearch} />
        <div className="search-footnote">
          <span>Considered places. Clear prices. Room to breathe.</span>
          <span>Demo collection · No real reservations or payments</span>
        </div>
      </div>
      <section className="travel-container travel-section">
        <Reveal>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Places with a little more soul</p>
              <h2>Somewhere you'll want to stay.</h2>
            </div>
            <button className="text-btn" onClick={() => onSearch(search)}>
              View all stays
              <ArrowUpRight size={18} />
            </button>
          </div>
          <div className="stay-grid">
            {active.slice(0, 3).map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                price={minPrice(p)}
                onOpen={() => onProperty(p.id)}
              />
            ))}
          </div>
          {!active.length && (
            <Empty
              title="New escapes are on their way"
              text="The collection is currently unavailable. Please check back for new stays."
            />
          )}
        </Reveal>
      </section>
      <section id="destinations" className="destination-section">
        <div className="travel-container">
          <Reveal>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Follow the feeling</p>
                <h2>Where would you rather be?</h2>
              </div>
              <p>
                From turquoise horizons to quiet mountain mornings.
                <br />
                Find a place that feels like you.
              </p>
            </div>
            <div className="destination-grid">
              {[
                {
                  name: "Island time",
                  tag: "EL NIDO, PALAWAN",
                  image: "/images/island.jpg",
                  dest: "El Nido, Palawan",
                },
                {
                  name: "A breath of fresh air",
                  tag: "BENGUET, CORDILLERA",
                  image: "/images/forest.jpg",
                  dest: "Benguet, Cordillera",
                },
                {
                  name: "Chase the coastline",
                  tag: "GENERAL LUNA, SIARGAO",
                  image: "/images/coast.jpg",
                  dest: "General Luna, Siargao",
                },
              ].map((d) => (
                <button
                  key={d.name}
                  className="destination-card"
                  onClick={() => onSearch({ ...search, destination: d.dest })}
                >
                  <img
                    src={d.image}
                    alt={d.name + " destination atmosphere"}
                    loading="lazy"
                    width="1000"
                    height="700"
                  />
                  <span>
                    <small>{d.tag}</small>
                    <strong>{d.name}</strong>
                    <ArrowUpRight size={22} />
                  </span>
                </button>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
      <section id="experiences" className="travel-container travel-section">
        <Reveal className="editorial">
          <div className="editorial-photo">
            <img
              src="/images/dining.jpg"
              alt="An intimate restaurant setting with thoughtfully prepared dishes"
              loading="lazy"
              width="1000"
              height="700"
            />
            <span>Little moments. Lasting memories.</span>
          </div>
          <div className="editorial-copy">
            <p className="eyebrow">Go beyond the beautiful view</p>
            <h2>
              Stay for the place.
              <br />
              <em>Remember the feeling.</em>
            </h2>
            <p>
              Set out on a sunset cruise. Follow a forest trail. Take your time
              over a local tasting menu. The best part of a trip is often the
              part you didn't plan.
            </p>
            <button
              className="btn primary"
              onClick={() => onProperty(active[0]?.id || "")}
            >
              Find your experience
              <ArrowUpRight size={17} />
            </button>
            <span className="fine-print">
              Optional experiences can be added to your demo reservation.
            </span>
          </div>
        </Reveal>
      </section>
      <section id="offers" className="offer-section">
        <div className="travel-container">
          <Reveal>
            <p className="eyebrow">A good reason to get away</p>
            <h2>
              A little more time.
              <br />A little less on your stay.
            </h2>
            {data.promotions
              .filter((p) => p.active && p.endDate >= dateKey())
              .map((p) => (
                <div className="offer-row" key={p.id}>
                  <div>
                    <h3>
                      {p.title} · {p.percent}% off rooms
                    </h3>
                    <p>{p.description}</p>
                    <p className="fine-print">
                      Use <strong>{p.code}</strong> at review · Valid through{" "}
                      {p.endDate}. Experiences excluded.
                    </p>
                  </div>
                  <button
                    className="btn ivory"
                    onClick={() => onSearch(search)}
                  >
                    Plan a slower escape
                    <ArrowRight size={17} />
                  </button>
                </div>
              ))}
            {!data.promotions.some(
              (p) => p.active && p.endDate >= dateKey(),
            ) && (
              <p>
                New seasonal escapes are on their way. Explore the collection
                today.
              </p>
            )}
          </Reveal>
        </div>
      </section>
      <section className="travel-container travel-section">
        <Reveal>
          <p className="eyebrow">The feeling stays with you</p>
          <div className="section-heading">
            <h2>Good places. Happy people.</h2>
            <p>Illustrative guest stories for this demo collection.</p>
          </div>
          <div className="review-grid">
            {[
              {
                quote:
                  "The kind of place where you forget to check your phone. Slow breakfasts, sea air, and a room we never wanted to leave.",
                name: "Camille R.",
                place: "An island escape",
              },
              {
                quote:
                  "Every detail felt considered. A quiet retreat, warm hospitality, and the easiest way to make a weekend feel like a real break.",
                name: "Miguel S.",
                place: "A mountain weekend",
              },
              {
                quote:
                  "A little adventure, a lot of rest. We loved having our room and experiences together in one simple reservation.",
                name: "Andrea L.",
                place: "A coastal getaway",
              },
            ].map((r) => (
              <article className="review-card" key={r.name}>
                <span
                  aria-label="Illustrative five star review"
                  className="review-stars"
                >
                  ★★★★★
                </span>
                <blockquote>“{r.quote}”</blockquote>
                <strong>{r.name}</strong>
                <p>{r.place} · Sample story</p>
              </article>
            ))}
          </div>
        </Reveal>
      </section>
    </main>
  );
}
