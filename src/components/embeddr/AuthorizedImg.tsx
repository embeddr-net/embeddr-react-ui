import React from "react";

export interface AuthorizedImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
  apiKey?: string;
}

export function AuthorizedImg({
  src,
  fallbackSrc,
  className,
  alt,
  apiKey,
  ...props
}: AuthorizedImgProps) {
  // Use Proxy strategy if we have an API key and it's an HTTP URL
  // This bypasses CORS and sends the API key from the backend side
  const proxySrc =
    apiKey && src.startsWith("http")
      ? `/embeddr/proxy?url=${encodeURIComponent(src)}`
      : src;

  return (
    <img
      src={proxySrc}
      alt={alt}
      className={className}
      onError={(e) => {
        if (fallbackSrc && e.currentTarget.src !== fallbackSrc) {
          e.currentTarget.src = fallbackSrc;
        }
      }}
      {...props}
    />
  );
}
