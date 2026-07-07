import { Link, NavLink } from "react-router-dom";
import { navLinkClass } from "../components/Common/Common";
import { WalletButton } from "../components/WalletButton";

const Header = () => {
  return (
    <header className="sticky top-0 z-20 border-b border-border-low/80 bg-bg1/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-sm font-bold text-accent">
            VP
          </span>
          <span className="font-semibold tracking-tight">
            Vesting Positions
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link to="/#how-it-works" className={navLinkClass(false)}>
            How it works
          </Link>
          <Link to="/#calculator" className={navLinkClass(false)}>
            Simulator
          </Link>
          <NavLink
            to="/app"
            end
            className={({ isActive }) => navLinkClass(isActive)}
          >
            App
          </NavLink>
          <NavLink
            to="/app/profile"
            className={({ isActive }) => navLinkClass(isActive)}
          >
            Profile
          </NavLink>
        </nav>

        <WalletButton />
      </div>
    </header>
  );
};

export default Header;
