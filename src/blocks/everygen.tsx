import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  Download,
  Film,
  ImagePlus,
  Loader2,
  Menu,
  Play,
  UploadCloud,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { PRICING_ENABLED } from '@/config/pricing';
import { apiGet, apiPost } from '@/lib/api-client';
import { draftGet, draftSet } from '@/lib/draft-store';
import { m } from '@/paraglide/messages.js';

import '@/styles/everygen.css';

const frames = {
  pier: '/imgs/generated/raindance-pier-look.jpg',
  breeze: '/imgs/generated/raindance-ocean-breeze.jpg',
  film: '/imgs/generated/raindance-vintage-film.jpg',
} as const;
const heroFrame = '/imgs/generated/raindance-pier-hero.jpg';
const duskVideo = '/videos/everygen-sunset-pier.mp4';
const DRAFT_KEY = 'everygen-photo-draft';

type Task = {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  stage?: 'scene' | 'video' | null;
  sceneImageUrl?: string | null;
  videoUrl?: string | null;
  error?: string | null;
};

const styles = ['pier', 'breeze', 'film'] as const;
type Style = (typeof styles)[number];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('Image could not be prepared'));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image could not be opened'));
    };
    image.src = url;
  });
}

export function EverygenHeader() {
  return (
    <header className="eg-header">
      <div className="eg-shell eg-header-inner">
        <Link href="/" className="eg-brand" aria-label={envConfigs.app_name}>
          <img src="/logo.svg" alt="" width="34" height="34" />
          <Wordmark />
        </Link>
        <nav className="eg-nav" aria-label={m['everygen.nav.label']()}>
          <a href="/#create">{m['everygen.nav.create']()}</a>
          <a href="/#looks">{m['everygen.nav.looks']()}</a>
          <a href="/#how">{m['everygen.nav.how']()}</a>
          {PRICING_ENABLED && (
            <Link href="/pricing">{m['everygen.nav.pricing']()}</Link>
          )}
        </nav>
        <div className="eg-header-actions">
          <Link href="/settings/videos" className="eg-nav-work">
            {m['everygen.nav.my_videos']()}
          </Link>
          <a href="/#create" className="eg-button eg-button-small">
            {m['everygen.nav.start']()}
            <ArrowRight size={15} />
          </a>
        </div>
        <details className="eg-mobile-nav">
          <summary aria-label={m['everygen.nav.label']()}>
            <Menu size={22} />
            <span className="sr-only">{m['everygen.nav.label']()}</span>
          </summary>
          <nav aria-label={m['everygen.nav.label']()}>
            <a href="/#create">{m['everygen.nav.create']()}</a>
            <a href="/#looks">{m['everygen.nav.looks']()}</a>
            <a href="/#how">{m['everygen.nav.how']()}</a>
            {PRICING_ENABLED && (
              <Link href="/pricing">{m['everygen.nav.pricing']()}</Link>
            )}
            <Link href="/settings/videos">{m['everygen.nav.my_videos']()}</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

/** "Raindance AI" set as serif italic name + small mono suffix. */
function Wordmark() {
  const [name, ...rest] = envConfigs.app_name.split(' ');
  return (
    <span className="eg-wordmark">
      {name}
      {rest.length > 0 && <small>{rest.join(' ')}</small>}
    </span>
  );
}

/** Dusk footage behind the hero, mounted only on wide screens with motion allowed. */
function HeroFootage() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 900px)').matches;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setShow(wide && !calm);
  }, []);
  return show ? (
    <video
      className="eg-hero-footage"
      src={duskVideo}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
    />
  ) : null;
}

function Hero() {
  return (
    <section className="eg-hero">
      <HeroFootage />
      <div className="eg-hero-tint" />
      <div className="eg-shell eg-hero-grid">
        <div className="eg-hero-copy">
          <p className="eg-kicker">{m['everygen.hero.kicker']()}</p>
          <h1>{m['everygen.hero.title']()}</h1>
          <p className="eg-hero-lede">{m['everygen.hero.description']()}</p>
          <div className="eg-hero-actions">
            <a href="/#create" className="eg-button">
              {m['everygen.hero.cta']()}
              <ArrowRight size={18} />
            </a>
            <a href="/#looks" className="eg-link">
              <Play size={14} fill="currentColor" />
              {m['everygen.hero.see_looks']()}
            </a>
          </div>
        </div>
        <figure className="eg-print">
          <div className="eg-print-frame">
            <img
              src={heroFrame}
              alt={m['everygen.looks.pier_alt']()}
              width="720"
              height="1280"
              fetchPriority="high"
            />
            <div className="eg-burn" aria-hidden="true">
              <span>00:00</span>
              <i>
                <b />
              </i>
              <span>00:05</span>
            </div>
          </div>
          <figcaption>{m['everygen.hero.frame_caption']()}</figcaption>
        </figure>
      </div>
    </section>
  );
}

function Studio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [style, setStyle] = useState<Style>('pier');
  const [consent, setConsent] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    let active = true;
    draftGet<{ photo: File | null; style: Style; consent: boolean }>(
      DRAFT_KEY
    ).then((draft) => {
      if (!active) return;
      if (draft?.photo) setPhoto(draft.photo);
      if (draft?.style && styles.includes(draft.style)) setStyle(draft.style);
      if (draft?.consent) setConsent(true);
      setDraftReady(true);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (draftReady) void draftSet(DRAFT_KEY, { photo, style, consent });
  }, [draftReady, photo, style, consent]);

  useEffect(() => {
    if (!photo) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!photo) throw new Error(m['everygen.studio.need_photo']());
      const photoData = await fileToDataUrl(photo);
      return apiPost<Task>('/api/everygen/generate', {
        photo: photoData,
        style,
        consent,
      });
    },
    onSuccess: (task) => {
      setTaskId(task.id);
      toast.success(m['everygen.studio.started']());
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const price = useQuery({
    queryKey: ['everygen-price'],
    queryFn: () => apiGet<{ credits: number }>('/api/everygen/price'),
    staleTime: 10 * 60_000,
  });
  const task = useQuery({
    queryKey: ['everygen-task', taskId],
    queryFn: () =>
      apiGet<Task>(`/api/everygen/task?id=${encodeURIComponent(taskId!)}`),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'success' || status === 'failed' ? false : 5000;
    },
  });
  const result = task.data;

  function selectFile(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error(m['everygen.studio.file_type']());
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(m['everygen.studio.file_size']());
      return;
    }
    setPhoto(file);
    setTaskId(null);
  }

  return (
    <section id="create" className="eg-create eg-shell">
      <div className="eg-section-heading">
        <p className="eg-kicker">{m['everygen.studio.kicker']()}</p>
        <h2>{m['everygen.studio.title']()}</h2>
        <p>{m['everygen.studio.description']()}</p>
      </div>
      <div className="eg-studio-grid">
        <div className="eg-studio-form">
          <div className="eg-field-heading">
            <span>{m['everygen.studio.photo_label']()}</span>
            <span>{m['everygen.studio.photo_hint']()}</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => selectFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className={`eg-upload ${photoUrl ? 'has-photo' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              selectFile(e.dataTransfer.files[0]);
            }}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={m['everygen.studio.uploaded_alt']()}
                width="360"
                height="360"
              />
            ) : (
              <>
                <UploadCloud size={30} strokeWidth={1.4} />
                <strong>{m['everygen.studio.upload']()}</strong>
                <span>{m['everygen.studio.upload_detail']()}</span>
              </>
            )}
          </button>
          {photo && (
            <button
              type="button"
              className="eg-file-remove"
              onClick={() => {
                setPhoto(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
            >
              <X size={14} />
              {photo.name}
            </button>
          )}
          <div className="eg-field-heading eg-style-heading">
            <span>{m['everygen.studio.style_label']()}</span>
            <span>{m['everygen.studio.style_hint']()}</span>
          </div>
          <div
            className="eg-style-choices"
            role="group"
            aria-label={m['everygen.studio.style_label']()}
          >
            {styles.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={style === item}
                className={style === item ? 'active' : ''}
                onClick={() => setStyle(item)}
              >
                <img
                  src={frames[item]}
                  alt=""
                  width="72"
                  height="128"
                  loading="lazy"
                />
                <span>{m[`everygen.style.${item}`]()}</span>
              </button>
            ))}
          </div>
          <label className="eg-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>{m['everygen.studio.consent']()}</span>
          </label>
          {session?.user ? (
            <button
              type="button"
              className="eg-button eg-submit"
              disabled={!photo || !consent || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Film size={18} />
              )}
              {mutation.isPending
                ? m['everygen.studio.submitting']()
                : m['everygen.studio.generate']()}
              <ArrowRight size={18} />
            </button>
          ) : (
            <Link
              href="/sign-in?callbackUrl=%2F%23create"
              className="eg-button eg-submit"
            >
              {m['everygen.studio.sign_in']()}
              <ArrowRight size={18} />
            </Link>
          )}
          <p className="eg-studio-note">
            {price.data
              ? m['everygen.studio.cost']({ credits: price.data.credits })
              : ''}
          </p>
          <p className="eg-studio-note">{m['everygen.studio.music_note']()}</p>
        </div>
        <div className="eg-studio-result">
          <div className="eg-monitor-bar" aria-hidden="true">
            <span>{m['everygen.studio.monitor']()}</span>
            <span>9:16</span>
          </div>
          {result?.status === 'success' && result.videoUrl ? (
            <>
              <video
                src={result.videoUrl}
                poster={result.sceneImageUrl || undefined}
                controls
                playsInline
                preload="none"
                className="eg-result-video"
              />
              <a
                className="eg-download"
                href={`/api/everygen/download?id=${result.id}`}
              >
                <Download size={17} />
                {m['everygen.studio.download']()}
              </a>
            </>
          ) : result?.status === 'failed' ? (
            <div className="eg-result-empty">
              <X size={30} />
              <strong>{m['everygen.studio.failed']()}</strong>
              <p>{result.error || m['everygen.studio.try_again']()}</p>
            </div>
          ) : result ? (
            <div className="eg-result-empty">
              {result.sceneImageUrl ? (
                <img
                  src={result.sceneImageUrl}
                  alt=""
                  width="576"
                  height="1024"
                  className="eg-progress-image"
                />
              ) : (
                <Loader2 size={30} className="animate-spin" />
              )}
              <strong>
                {result.stage === 'video'
                  ? m['everygen.studio.animating']()
                  : m['everygen.studio.composing']()}
              </strong>
              <p>{m['everygen.studio.wait']()}</p>
            </div>
          ) : (
            <div className="eg-result-empty">
              <div className="eg-result-icon">
                <ImagePlus size={34} strokeWidth={1.3} />
              </div>
              <strong>{m['everygen.studio.preview_title']()}</strong>
              <p>{m['everygen.studio.preview_description']()}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Looks() {
  const looks = [
    {
      key: 'pier',
      media: (
        <img
          src={frames.pier}
          alt={m['everygen.looks.pier_alt']()}
          loading="lazy"
          width="720"
          height="1280"
        />
      ),
      title: m['everygen.looks.pier'](),
      desc: m['everygen.looks.pier_desc'](),
    },
    {
      key: 'breeze',
      media: (
        <img
          src={frames.breeze}
          alt={m['everygen.looks.breeze_alt']()}
          loading="lazy"
          width="720"
          height="1280"
        />
      ),
      title: m['everygen.looks.breeze'](),
      desc: m['everygen.looks.breeze_desc'](),
    },
    {
      key: 'film',
      media: (
        <img
          src={frames.film}
          alt={m['everygen.looks.film_alt']()}
          loading="lazy"
          width="720"
          height="1280"
        />
      ),
      title: m['everygen.looks.film'](),
      desc: m['everygen.looks.film_desc'](),
    },
  ];
  return (
    <section id="looks" className="eg-looks eg-shell">
      <div className="eg-looks-head">
        <h2>{m['everygen.looks.title']()}</h2>
        <p>{m['everygen.looks.description']()}</p>
      </div>
      <div className="eg-look-row">
        {looks.map((look) => (
          <figure key={look.key} className={`eg-look eg-look-${look.key}`}>
            <div className="eg-look-frame">{look.media}</div>
            <figcaption>
              <h3>{look.title}</h3>
              <p>{look.desc}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/** Three steps read as one sunset: the sun lowers toward the horizon with each. */
function How() {
  const steps = [
    {
      icon: ImagePlus,
      title: m['everygen.how.upload'](),
      desc: m['everygen.how.upload_desc'](),
    },
    {
      icon: Film,
      title: m['everygen.how.choose'](),
      desc: m['everygen.how.choose_desc'](),
    },
    {
      icon: Download,
      title: m['everygen.how.share'](),
      desc: m['everygen.how.share_desc'](),
    },
  ];
  return (
    <section id="how" className="eg-how">
      <div className="eg-shell">
        <h2 className="eg-how-title">{m['everygen.how.title']()}</h2>
        <ol className="eg-sunset">
          {steps.map(({ icon: Icon, title, desc }) => (
            <li key={title}>
              <div className="eg-sky" aria-hidden="true">
                <span className="eg-sun" />
              </div>
              <Icon size={20} strokeWidth={1.5} />
              <h3>{title}</h3>
              <p>{desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Guide() {
  const parts = [
    [
      'make',
      m['everygen.guide.make.title'](),
      m['everygen.guide.make.one'](),
      m['everygen.guide.make.two'](),
    ],
    [
      'photo',
      m['everygen.guide.photo.title'](),
      m['everygen.guide.photo.one'](),
      m['everygen.guide.photo.two'](),
    ],
    [
      'look',
      m['everygen.guide.look.title'](),
      m['everygen.guide.look.one'](),
      m['everygen.guide.look.two'](),
    ],
    [
      'share',
      m['everygen.guide.share.title'](),
      m['everygen.guide.share.one'](),
      m['everygen.guide.share.two'](),
    ],
  ] as const;
  return (
    <section
      className="eg-guide eg-shell"
      aria-labelledby="raindance-guide-title"
    >
      <header className="eg-guide-side">
        <p className="eg-kicker">{m['everygen.guide.kicker']()}</p>
        <h2 id="raindance-guide-title">{m['everygen.guide.title']()}</h2>
        <a href="/#create" className="eg-link">
          {m['everygen.guide.start']()}
          <ArrowUpRight size={16} />
        </a>
      </header>
      <div className="eg-guide-body">
        <p className="eg-guide-lede">{m['everygen.guide.intro.one']()}</p>
        <p>{m['everygen.guide.intro.two']()}</p>
        {parts.map(([key, title, one, two]) => (
          <article key={key}>
            <h3>{title}</h3>
            <p>{one}</p>
            <p>{two}</p>
          </article>
        ))}
        <p className="eg-guide-ready">
          {m['everygen.guide.ready']()}{' '}
          <a href="/#create">
            {m['everygen.guide.start']()}
            <ArrowRight size={15} />
          </a>
        </p>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="eg-cta">
      <div className="eg-cta-frame">
        <video
          src={duskVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
        />
        <div className="eg-cta-inner eg-shell">
          <h2>{m['everygen.cta.title']()}</h2>
          <p>{m['everygen.cta.description']()}</p>
          <a href="/#create" className="eg-button">
            {m['everygen.cta.button']()}
            <ArrowRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="eg-faq eg-shell">
      <h2>{m['everygen.faq.title']()}</h2>
      <div className="eg-faq-list">
        {(['photo', 'length', 'music', 'share', 'rights'] as const).map(
          (key) => (
            <details key={key}>
              <summary>{m[`everygen.faq.${key}.q`]()}</summary>
              <p>{m[`everygen.faq.${key}.a`]()}</p>
            </details>
          )
        )}
      </div>
    </section>
  );
}

export function EverygenFooter() {
  const [name, ...rest] = envConfigs.app_name.split(' ');
  return (
    <footer className="eg-footer">
      <div className="eg-shell">
        <div className="eg-footer-main">
          <p className="eg-footer-tagline">{m['everygen.footer.tagline']()}</p>
          <nav aria-label={m['everygen.footer.links']()}>
            {PRICING_ENABLED && (
              <Link href="/pricing">{m['everygen.nav.pricing']()}</Link>
            )}
            <Link href="/settings/videos">{m['everygen.nav.my_videos']()}</Link>
            <Link href="/privacy-policy">{m['everygen.footer.privacy']()}</Link>
            <Link href="/terms-of-service">{m['everygen.footer.terms']()}</Link>
          </nav>
        </div>
        <p className="eg-footer-mark" aria-hidden="true">
          {name}
          {rest.length > 0 && <small>{rest.join(' ')}</small>}
        </p>
        <div className="eg-footer-bottom">
          <span>
            © {new Date().getFullYear()} {envConfigs.app_name}
          </span>
        </div>
      </div>
    </footer>
  );
}

export function EverygenPage() {
  return (
    <main className="eg-page">
      <EverygenHeader />
      <Hero />
      <Studio />
      <Looks />
      <How />
      <Guide />
      <Cta />
      <Faq />
      <EverygenFooter />
    </main>
  );
}
