// EA TRADERS brand mark (raster logo, see /public/assets/branding)
import brandConfig from '@/../brand.config.json';

type TBrandLogoProps = {
    width?: number;
    height?: number;
    /** Unused for the raster mark; kept so existing width/height-only call sites keep compiling */
    fill?: string;
    className?: string;
    /** Show the "EA TRADERS" wordmark next to the icon mark */
    showText?: boolean;
};

export const BrandLogo = ({ width, height = 32, className = '', showText }: TBrandLogoProps) => {
    const logo_config = brandConfig.platform.logo;
    const should_show_text = showText ?? logo_config.show_text;
    // Icon mark is square (no embedded wordmark) — keep that aspect ratio when only height is given.
    const computed_width = width ?? Math.round(height);

    return (
        <span
            className={`brand-logo ${className}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.8rem', lineHeight: 1 }}
        >
            <img
                src='/assets/branding/logo-mark-v2.png'
                alt={logo_config.alt_text}
                width={computed_width}
                height={height}
                style={{ display: 'block', height, width: computed_width, objectFit: 'contain' }}
            />
            {should_show_text && (
                <span
                    className='brand-logo__text'
                    style={{ fontWeight: 800, fontSize: `${Math.max(height * 0.5, 14)}px`, color: '#ffffff' }}
                >
                    {logo_config.text}
                </span>
            )}
        </span>
    );
};
