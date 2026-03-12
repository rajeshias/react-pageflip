import React, {
    ReactElement,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';

import { PageFlip } from 'page-flip';
import { IFlipSetting, IEventProps } from './settings';
import { usePageFlipAudio } from './usePageFlipAudio';

interface IProps extends IFlipSetting, IEventProps {
    className: string;
    style: React.CSSProperties;
    children: React.ReactNode;
    renderOnlyPageLengthChange?: boolean;
}

const HTMLFlipBookForward = React.forwardRef(
    (props: IProps, ref: React.MutableRefObject<PageFlip>) => {
        const htmlElementRef = useRef<HTMLDivElement>(null);
        const childRef = useRef<HTMLElement[]>([]);
        const pageFlip = useRef<PageFlip>();

        const [pages, setPages] = useState<ReactElement[]>([]);

        const { handleChangeState: audioChangeState, handleFlipProgress: audioFlipProgress } =
            usePageFlipAudio();

        useImperativeHandle(ref, () => ({
            pageFlip: () => pageFlip.current,
        }));

        const refreshOnPageDelete = useCallback(() => {
            if (pageFlip.current) {
                pageFlip.current.clear();
            }
        }, []);

        const removeHandlers = useCallback(() => {
            const flip = pageFlip.current;

            if (flip) {
                flip.off('flip');
                flip.off('changeOrientation');
                flip.off('changeState');
                flip.off('init');
                flip.off('update');
                flip.off('flipProgress');
            }
        }, []);

        useEffect(() => {
            childRef.current = [];

            if (props.children) {
                const childList = React.Children.map(props.children, (child) => {
                    return React.cloneElement(child as ReactElement, {
                        ref: (dom) => {
                            if (dom) {
                                childRef.current.push(dom);
                            }
                        },
                    });
                });

                if (!props.renderOnlyPageLengthChange || pages.length !== childList.length) {
                    if (childList.length < pages.length) {
                        refreshOnPageDelete();
                    }

                    setPages(childList);
                }
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [props.children]);

        useEffect(() => {
            const setHandlers = () => {
                const flip = pageFlip.current;

                if (flip) {
                    if (props.onFlip) {
                        flip.on('flip', (e: unknown) => props.onFlip(e));
                    }

                    if (props.onChangeOrientation) {
                        flip.on('changeOrientation', (e: unknown) => props.onChangeOrientation(e));
                    }

                    // Always feed changeState into the audio engine; also forward to consumer
                    flip.on('changeState', (e: unknown) => {
                        audioChangeState(e as { data: unknown });
                        if (props.onChangeState) props.onChangeState(e);
                    });

                    if (props.onInit) {
                        flip.on('init', (e: unknown) => props.onInit(e));
                    }

                    if (props.onUpdate) {
                        flip.on('update', (e: unknown) => props.onUpdate(e));
                    }

                    // Always wire flipProgress for audio; also forward to consumer
                    flip.on('flipProgress', (e: unknown) => {
                        audioFlipProgress(e as { data: unknown });
                        if (props.onFlipProgress) props.onFlipProgress(e);
                    });
                }
            };

            if (pages.length > 0 && childRef.current.length > 0) {
                removeHandlers();

                if (htmlElementRef.current && !pageFlip.current) {
                    pageFlip.current = new PageFlip(htmlElementRef.current, props);
                }

                if (!pageFlip.current.getFlipController()) {
                    pageFlip.current.loadFromHTML(childRef.current);
                } else {
                    pageFlip.current.updateFromHtml(childRef.current);
                }

                setHandlers();
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [pages]);

        return (
            <div ref={htmlElementRef} className={props.className} style={props.style}>
                {pages}
            </div>
        );
    }
);

export const HTMLFlipBook = React.memo(HTMLFlipBookForward);
