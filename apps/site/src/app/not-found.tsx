import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="section">
      <div className="wrap stack-lg">
        <h1 className="t-page">Not found</h1>
        <p className="body t2 measure">There&apos;s no page at this address. It may have moved.</p>
        <div className="btns">
          <Link className="btn btn-quiet" href="/">
            Go to the home page
          </Link>
        </div>
      </div>
    </section>
  );
}
