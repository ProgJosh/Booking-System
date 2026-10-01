import {
  Component,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Menu,
  X,
  UserRound,
  Compass,
  LoaderCircle,
  LogOut,
} from "lucide-react";
import { api, type Session } from "./lib/api";
import { errorMessage } from "./lib/validation";
import {
  canManageProperty,
  type TravelData,
  type StaySearch,
  type Room,
} from "./lib/travel";
import { TravelSite, initialSearch } from "./pages/TravelSite";
import { TravelAuth } from "./pages/TravelAuth";
import { TravelWorkspace, ReservationList } from "./pages/TravelWorkspace";
import { Profile } from "./pages/Management";
import { StayBooking, ReservationDetail } from "./components/StayBooking";
import { Modal, Toast } from "./components/ui";
function Brand() {
  return (
    <>
      <span className="travel-brand-mark">
        <Compass strokeWidth={1.3} />
      </span>
      <span>
        Alder <i>&</i> Tide<small>STAYS THAT STAY WITH YOU</small>
      </span>
    </>
  );
}
const route = () => {
  try {
    const h = decodeURIComponent(location.hash.slice(1));
    return ["destinations", "experiences", "offers"].includes(h)
      ? "home"
      : h.startsWith("property/") ||
          h.startsWith("manage/") ||
          ["home", "stays", "account", "trips", "profile"].includes(h)
        ? h
        : "home";
  } catch {
    return "home";
  }
};
function Website() {
  const [session, setSession] = useState<Session>({ db: null, user: null }),
    [catalog, setCatalog] = useState<TravelData | null>(null),
    [loading, setLoading] = useState(true),
    [fatal, setFatal] = useState("");
  const [page, setPage] = useState(route),
    [search, setSearch] = useState<StaySearch>(initialSearch),
    [menu, setMenu] = useState(false),
    [toast, setToast] = useState(""),
    [info, setInfo] = useState("");
  const [booking, setBooking] = useState<{
      roomId: string;
      existingId?: string;
    } | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [pendingRoom, setPendingRoom] = useState("");
  const refresh = useCallback(() => {
    try {
      setSession(api.snapshot());
      setCatalog(api.catalog());
      setFatal("");
    } catch (err) {
      setFatal(errorMessage(err));
    }
  }, []);
  useEffect(() => {
    let alive = true;
    api
      .initialize()
      .then(() => {
        if (alive) {
          refresh();
          setLoading(false);
        }
      })
      .catch((err) => {
        if (alive) {
          setFatal(errorMessage(err));
          setLoading(false);
        }
      });
    const hash = () => {
      setPage(route());
      setMenu(false);
    };
    const tick = window.setInterval(refresh, 60000);
    window.addEventListener("morrow:update", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("hashchange", hash);
    return () => {
      alive = false;
      clearInterval(tick);
      window.removeEventListener("morrow:update", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("hashchange", hash);
    };
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const { user, db } = session;
  function navigate(p: string) {
    setPage(p);
    location.hash = p;
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function section(id: string) {
    navigate("home");
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }, 60);
  }
  function find(s: StaySearch) {
    setSearch(s);
    navigate("stays");
  }
  function reserve(room: Room) {
    if (!user) {
      setPendingRoom(room.id);
      navigate("account");
      return;
    }
    if (
      user.role === "staff" &&
      !canManageProperty(
        user,
        catalog!.properties.find((p) => p.id === room.propertyId)!,
      )
    ) {
      setToast("Your staff account can reserve only at assigned properties.");
      return;
    }
    setBooking({ roomId: room.id });
  }
  function signedIn() {
    const next = api.snapshot();
    setSession(next);
    if (pendingRoom) {
      const room = catalog!.rooms.find((r) => r.id === pendingRoom);
      setPendingRoom("");
      if (room) {
        navigate("property/" + room.propertyId);
        setBooking({ roomId: room.id });
        return;
      }
    }
    navigate(next.user?.role === "customer" ? "trips" : "manage/overview");
  }
  useEffect(() => {
    if (!user) {
      setBooking(null);
      setSelected(null);
    }
  }, [user]);
  if (loading || (!catalog && !fatal))
    return (
      <div className="travel-loading">
        <Compass size={40} />
        <h1>Your elsewhere is on its way.</h1>
        <LoaderCircle className="spin" />
        <p>Preparing the demo collection…</p>
      </div>
    );
  if (fatal || !catalog)
    return (
      <div className="travel-loading">
        <h1>We couldn't load the collection.</h1>
        <p role="alert">{fatal}</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  const r = db?.travel?.reservations.find((r) => r.id === selected),
    room = catalog.rooms.find((r) => r.id === booking?.roomId),
    existing = db?.travel?.reservations.find(
      (r) => r.id === booking?.existingId,
    );
  const needsAccount =
    ["trips", "profile"].includes(page) || page.startsWith("manage/");
  const management =
    page.startsWith("manage/") && !!user && user.role !== "customer";
  const accountPage = page === "account" || (needsAccount && !user);
  const nav = [
    { text: "Stays", click: () => find(search) },
    { text: "Destinations", click: () => section("destinations") },
    { text: "Experiences", click: () => section("experiences") },
    { text: "Offers", click: () => section("offers") },
  ];
  return (
    <div className="travel-app">
      <a
        className="skip-link"
        href="#content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("content")?.focus();
          document.getElementById("content")?.scrollIntoView();
        }}
      >
        Skip to content
      </a>
      <header className="travel-header">
        <div className="header-inner">
          <a
            href="#home"
            className="travel-brand"
            onClick={(e) => {
              e.preventDefault();
              navigate("home");
            }}
            aria-label="Alder and Tide home"
          >
            <Brand />
          </a>
          <nav className="desktop-nav" aria-label="Main navigation">
            {nav.map((n) => (
              <button
                key={n.text}
                className={
                  page === "stays" && n.text === "Stays" ? "active" : ""
                }
                onClick={n.click}
              >
                {n.text}
              </button>
            ))}
          </nav>
          <div className="header-account">
            {user ? (
              <>
                <button
                  className="account-link"
                  aria-label="My stays"
                  onClick={() => navigate("trips")}
                >
                  <UserRound size={17} />
                  <span>My stays</span>
                </button>
                {user.role !== "customer" && (
                  <button
                    className="manage-link"
                    onClick={() => navigate("manage/overview")}
                  >
                    Manage
                  </button>
                )}
                <button
                  className="icon-btn"
                  aria-label="Sign out"
                  onClick={() => {
                    api.logout();
                    setBooking(null);
                    setSelected(null);
                    navigate("home");
                  }}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button
                className="account-link"
                aria-label="Sign in"
                onClick={() => navigate("account")}
              >
                <UserRound size={17} />
                <span>Sign in</span>
              </button>
            )}
            <button
              className="btn primary header-book"
              onClick={() => find(search)}
            >
              Book a stay
              <ArrowUpRight size={16} />
            </button>
            <button
              className="icon-btn mobile-menu-button"
              aria-label={menu ? "Close navigation" : "Open navigation"}
              aria-expanded={menu}
              aria-controls="mobile-navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menu && (
          <nav
            id="mobile-navigation"
            className="mobile-nav"
            aria-label="Mobile navigation"
          >
            {nav.map((n) => (
              <button key={n.text} onClick={n.click}>
                {n.text}
                <ArrowRight size={16} />
              </button>
            ))}
            <button onClick={() => navigate(user ? "profile" : "account")}>
              {user ? "My profile" : "Sign in / Register"}
            </button>
            {user?.role !== "customer" && user && (
              <button onClick={() => navigate("manage/overview")}>
                Manage properties
              </button>
            )}
          </nav>
        )}
      </header>
      <div id="content" tabIndex={-1}>
        {accountPage ? (
          user ? (
            <main className="travel-container account-welcome">
              <h1>Welcome, {user.name}.</h1>
              <button className="btn primary" onClick={() => navigate("trips")}>
                View reservations
              </button>
            </main>
          ) : (
            <TravelAuth onSuccess={signedIn} />
          )
        ) : management && db && user ? (
          <TravelWorkspace
            key={user.id}
            db={db}
            user={user}
            tab={page.split("/")[1]}
            onTab={(t) => navigate("manage/" + t)}
            onSelect={(r) => setSelected(r.id)}
            notify={setToast}
            onExplore={() => find(search)}
          />
        ) : page === "profile" && user ? (
          <main className="travel-container profile-page">
            <button className="text-btn" onClick={() => navigate("trips")}>
              Back to reservations
            </button>
            <Profile key={user.id} user={user} notify={setToast} />
          </main>
        ) : (page === "trips" || page.startsWith("manage/")) && db && user ? (
          <main className="travel-container trips-page">
            <div className="trips-top">
              <button className="text-btn" onClick={() => navigate("profile")}>
                My profile
                <ArrowUpRight size={16} />
              </button>
              <button className="btn primary" onClick={() => find(search)}>
                Explore stays
                <ArrowRight size={17} />
              </button>
            </div>
            <ReservationList
              data={db.travel!}
              user={user}
              onSelect={(r) => setSelected(r.id)}
            />
          </main>
        ) : (
          <TravelSite
            data={catalog}
            page={page}
            search={search}
            onSearch={find}
            onProperty={(id) => navigate("property/" + id)}
            onReserve={reserve}
          />
        )}
      </div>
      <footer className="travel-footer">
        <div className="travel-container">
          <div className="footer-top">
            <div>
              <a
                className="travel-brand"
                href="#home"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("home");
                }}
              >
                <Brand />
              </a>
              <p>
                Beautiful places. Thoughtful stays.
                <br />A little more room for what matters.
              </p>
              <span className="footer-note">
                A fictional Philippine travel collection.
              </span>
            </div>
            <div>
              <h3>Find your elsewhere</h3>
              {nav.map((n) => (
                <button key={n.text} onClick={n.click}>
                  {n.text}
                </button>
              ))}
            </div>
            <div>
              <h3>Your journey</h3>
              <button onClick={() => navigate(user ? "trips" : "account")}>
                Your reservations
              </button>
              <button onClick={() => navigate(user ? "profile" : "account")}>
                Your account
              </button>
              <button onClick={() => setInfo("Booking help")}>
                Booking help
              </button>
            </div>
            <div>
              <h3>Let's make it a good stay.</h3>
              <p>Questions about this demo?</p>
              <a
                href={
                  "mailto:" + (db?.settings.email || "hello@alderandtide.demo")
                }
              >
                {db?.settings.email || "hello@alderandtide.demo"}
              </a>
              <p>
                Philippines · Manila time
                <br />
                All prices in PHP (₱)
              </p>
            </div>
          </div>
          <div className="footer-bottom">
            <span>
              © {new Date().getFullYear()} Alder & Tide. A local booking demo.
            </span>
            <div>
              <button onClick={() => setInfo("Privacy")}>Privacy</button>
              <button onClick={() => setInfo("Booking terms")}>
                Booking terms
              </button>
            </div>
            <span>No real reservations or payment collection.</span>
          </div>
        </div>
      </footer>
      {booking && room && db && user && (
        <StayBooking
          key={room.id + (existing?.id || "")}
          data={catalog}
          db={db}
          user={user}
          room={room}
          search={search}
          existing={existing}
          onClose={() => {
            setBooking(null);
            navigate(
              user.role === "customer" ? "trips" : "manage/reservations",
            );
          }}
        />
      )}
      {r && user && (
        <ReservationDetail
          reservation={r}
          user={user}
          notify={setToast}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setSelected(null);
            setBooking({ roomId: r.roomId, existingId: r.id });
          }}
        />
      )}
      {toast && <Toast message={toast} />}
      {info && (
        <Modal title={info} onClose={() => setInfo("")}>
          <div className="modal-body">
            {info === "Privacy" ? (
              <>
                <h3>Your data stays in this browser.</h3>
                <p>
                  This demo stores account details, password hashes, and
                  reservations in local storage. It does not send data to a
                  backend, email provider, or payment service. Use sample
                  information. Clearing site storage removes local demo changes.
                </p>
                <p>
                  This is not a production authentication system. A backend and
                  secure sessions are required before hosting real guest data.
                </p>
              </>
            ) : info === "Booking terms" ? (
              <>
                <h3>A collection for trying things out.</h3>
                <p>
                  All resorts, rates, availability, reviews, and reservations
                  are fictional. Choose one room per reservation for 1–30
                  nights. Children count toward room capacity. Listed prices
                  include demo taxes; optional experiences are charged once per
                  reservation.
                </p>
                <p>
                  Requests are pending until an authorized host confirms them.
                  Change dates or cancel before the check-in day. Local payment
                  apps are preferences only; no payment is collected.
                </p>
              </>
            ) : (
              <>
                <h3>Three easy steps to your demo stay.</h3>
                <p>
                  Search your destination, dates, and guests. Choose an
                  available room, add optional experiences, then sign in or
                  register with sample guest information. Review your price and
                  request a reservation.
                </p>
                <p>
                  Find your request under My stays. Open its details to change
                  dates or cancel before check-in. The system checks every
                  occupied night to prevent reservations exceeding room
                  inventory.
                </p>
                <p>
                  Admin and Staff demo accounts are available on the sign-in
                  page. Staff manage assigned properties; administrators manage
                  the full collection.
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div className="travel-loading">
        <h1>Something interrupted your journey.</h1>
        <p role="alert">{this.state.error}</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <Website />
    </ErrorBoundary>
  );
}
