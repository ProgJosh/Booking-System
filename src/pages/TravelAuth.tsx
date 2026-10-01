import { errorMessage } from "../lib/validation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { api } from "../lib/api";
import { Field, ErrorNotice, SubmitButton } from "../components/ui";
export function TravelAuth({ onSuccess }: { onSuccess: () => void }) {
  const [register, setRegister] = useState(false),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [input, setInput] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  async function demo(email: string) {
    setBusy(true);
    setError("");
    try {
      await api.login(email, "Morrow2026!");
      onSuccess();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="travel-auth travel-container">
      <div className="auth-picture">
        <img
          src="/images/forest.jpg"
          alt="Sunlight reaching through a tranquil forest canopy"
          width="1000"
          height="700"
        />
        <div>
          <p className="eyebrow">Alder & Tide</p>
          <h2>
            Your next good
            <br />
            place is waiting.
          </h2>
          <p>Save your stays. Make room for memories.</p>
        </div>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (register) await api.register(input);
            else await api.login(input.email, input.password);
            onSuccess();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="eyebrow">Welcome to your elsewhere</p>
        <h1>
          {register ? "A new adventure awaits." : "Good to see you again."}
        </h1>
        <p>
          {register
            ? "Create a demo guest account to keep your stays in one place."
            : "Sign in to manage your stays and guest details."}
        </p>
        <ErrorNotice error={error} />
        {register && (
          <>
            <Field label="Full name">
              <input
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
                value={input.name}
                onChange={(e) => setInput({ ...input, name: e.target.value })}
              />
            </Field>
            <Field label="Phone number">
              <input
                required
                type="tel"
                autoComplete="tel"
                placeholder="+63 917 123 4567"
                value={input.phone}
                onChange={(e) => setInput({ ...input, phone: e.target.value })}
              />
            </Field>
          </>
        )}
        <Field label="Email address">
          <input
            required
            type="email"
            autoComplete="email"
            value={input.email}
            onChange={(e) => setInput({ ...input, email: e.target.value })}
          />
        </Field>
        <Field
          label="Password"
          hint={register ? "Use at least 8 characters." : undefined}
        >
          <div className="password-input">
            <input
              aria-label="Password"
              required
              minLength={register ? 8 : 1}
              type={show ? "text" : "password"}
              autoComplete={register ? "new-password" : "current-password"}
              value={input.password}
              onChange={(e) => setInput({ ...input, password: e.target.value })}
            />
            <button
              type="button"
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>
        <SubmitButton busy={busy}>
          {register ? "Create guest account" : "Sign in"}
          <ArrowRight size={16} />
        </SubmitButton>
        <button
          type="button"
          className="text-btn account-toggle"
          disabled={busy}
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
        <div className="demo-access">
          <p className="eyebrow">Take a look around</p>
          <div>
            {[
              { role: "Guest", email: "emmanuel.josh.velo@example.com" },
              { role: "Staff", email: "emmanuel.staff@Wellora.demo" },
              { role: "Admin", email: "admin@BookSync.demo" },
            ].map((d) => (
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                key={d.role}
                onClick={() => demo(d.email)}
              >
                {d.role} demo
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
          <p className="fine-print">
            Local demo only. Use sample contact details.
            <br />
            Existing demo password: Morrow2026!
          </p>
        </div>
      </form>
    </main>
  );
}
