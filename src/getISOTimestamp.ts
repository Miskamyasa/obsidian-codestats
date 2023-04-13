// converted to ts from https://github.com/Nicd/code-stats-atom/blob/master/lib/utils.js
export default function getISOTimestamp(date: Date): string {
    const offset: number = -date.getTimezoneOffset();
    const prefix: string = offset >= 0 ? "+" : "-";

    function pad(num: number): string {
        const norm: number = Math.abs(Math.floor(num));
        return (norm < 10 ? "0" : "") + norm;
    }

    return (
        date.getFullYear() +
        "-" +
        pad(date.getMonth() + 1) +
        "-" +
        pad(date.getDate()) +
        "T" +
        pad(date.getHours()) +
        ":" +
        pad(date.getMinutes()) +
        ":" +
        pad(date.getSeconds()) +
        prefix +
        pad(offset / 60) +
        pad(offset % 60)
    );
}
