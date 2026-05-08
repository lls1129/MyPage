export function SearchBox() {
  return (
    <form
      className="lift bg-white border border-pink-100 rounded-lg p-5 shadow-soft flex flex-col gap-2"
      action="/search"
    >
      <label htmlFor="site-search" className="label text-pink-600">
        search
      </label>
      <input
        id="site-search"
        name="q"
        type="search"
        placeholder="find a memory…"
        className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200"
      />
    </form>
  );
}
