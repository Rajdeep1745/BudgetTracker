import Image from "next/image";

export default function BrandLogo() {
  return (
    <>
      <Image
        src="/logo/pocketplan-mark.svg"
        alt=""
        width={38}
        height={38}
        className="h-9 w-9 shrink-0 object-contain"
        unoptimized
      />
      <span className="whitespace-nowrap text-[#07344b]">
        Pocket<span className="text-[#128737]">Plan</span>
      </span>
    </>
  );
}
