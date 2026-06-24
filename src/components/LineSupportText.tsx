const lineSupportUrl = 'https://lin.ee/6Tpje1P'
const lineSupportPattern = /(客服 LINE：https:\/\/lin\.ee\/6Tpje1P|客服 LINE https:\/\/lin\.ee\/6Tpje1P|https:\/\/lin\.ee\/6Tpje1P|客服 LINE)/g

export function LineSupportText({ text }: { text: string }) {
  return (
    <>
      {text.split(lineSupportPattern).map((part, index) => {
        if (!part) return null

        if (part.includes('客服 LINE') || part === lineSupportUrl) {
          return (
            <a className="font-semibold text-deepPurple underline underline-offset-4" href={lineSupportUrl} key={`${part}-${index}`} rel="noopener noreferrer" target="_blank">
              {part}
            </a>
          )
        }

        return part
      })}
    </>
  )
}
