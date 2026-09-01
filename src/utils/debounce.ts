/**
 * 创建一个防抖函数
 * @param func 要防抖的函数
 * @param wait 等待时间（毫秒）
 * @param immediate 是否立即执行
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number,
    immediate = false
): (...args: Parameters<T>) => void {
    let timeout: number | null = null;

    return function(this: unknown, ...args: Parameters<T>): void {
        const later = () => {
            timeout = null;
            if (!immediate) {
                func.apply(this, args);
            }
        };

        const callNow = immediate && !timeout;

        if (timeout) {
            window.clearTimeout(timeout);
        }

        timeout = window.setTimeout(later, wait);

        if (callNow) {
            func.apply(this, args);
        }
    };
}
